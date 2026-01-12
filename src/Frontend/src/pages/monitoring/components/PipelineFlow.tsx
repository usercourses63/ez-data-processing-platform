import React, { useEffect, useRef, useState } from 'react';
import { Card, Tooltip } from 'antd';
import { useTranslation } from 'react-i18next';
import { ServiceStatus, DataParticle } from '../../../types/monitoring.types';
import {
  PIPELINE_CONNECTIONS,
  getServicePositions,
  simulateDataFlow,
} from '../../../services/monitoring-mock-data';

interface PipelineFlowProps {
  services: ServiceStatus[];
}

interface ServicePosition {
  id: string;
  name: string;
  displayName: string;
  x: number;
  y: number;
  icon: string;
}

const PipelineFlow: React.FC<PipelineFlowProps> = ({ services }) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<DataParticle[]>([]);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const servicePositions = getServicePositions();
  const [hoveredService, setHoveredService] = useState<ServiceStatus | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Constants
  const NODE_WIDTH = 120;
  const NODE_HEIGHT = 80;
  const PARTICLE_SIZE = 8;
  const PARTICLE_DURATION = 1000; // ms

  // Get service status by id
  const getServiceById = (id: string): ServiceStatus | undefined => {
    return services.find(s => s.id === id);
  };

  // Get node color based on status
  const getNodeColor = (status: string): string => {
    switch (status) {
      case 'healthy':
        return '#52c41a';
      case 'warning':
        return '#faad14';
      case 'error':
        return '#ff4d4f';
      default:
        return '#888';
    }
  };

  // Draw a service node
  const drawNode = (
    ctx: CanvasRenderingContext2D,
    position: ServicePosition,
    service: ServiceStatus | undefined
  ) => {
    const { x, y, icon, displayName } = position;
    const status = service?.status || 'unknown';
    const color = getNodeColor(status);

    // Draw node background
    ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
    ctx.fillRect(x, y, NODE_WIDTH, NODE_HEIGHT);

    // Draw border with status color
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, NODE_WIDTH, NODE_HEIGHT);

    // Draw icon
    ctx.font = '32px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(icon, x + NODE_WIDTH / 2, y + 28);

    // Draw service name
    ctx.font = '11px Arial';
    ctx.fillStyle = '#e0e0e0';
    const words = displayName.split(' ');
    words.forEach((word, index) => {
      ctx.fillText(word, x + NODE_WIDTH / 2, y + 55 + index * 12);
    });

    // Draw pulse effect for processing status
    if (service && Math.random() > 0.7) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.3;
      ctx.strokeRect(x - 5, y - 5, NODE_WIDTH + 10, NODE_HEIGHT + 10);
      ctx.globalAlpha = 1;
    }
  };

  // Draw connection line between nodes
  const drawConnection = (
    ctx: CanvasRenderingContext2D,
    from: ServicePosition,
    to: ServicePosition
  ) => {
    const fromCenterX = from.x + NODE_WIDTH / 2;
    const fromCenterY = from.y + NODE_HEIGHT / 2;
    const toCenterX = to.x + NODE_WIDTH / 2;
    const toCenterY = to.y + NODE_HEIGHT / 2;

    // Create gradient
    const gradient = ctx.createLinearGradient(fromCenterX, fromCenterY, toCenterX, toCenterY);
    gradient.addColorStop(0, 'rgba(102, 126, 234, 0.3)');
    gradient.addColorStop(0.5, 'rgba(102, 126, 234, 0.6)');
    gradient.addColorStop(1, 'rgba(102, 126, 234, 0.3)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(fromCenterX, fromCenterY);
    ctx.lineTo(toCenterX, toCenterY);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Draw animated particle
  const drawParticle = (ctx: CanvasRenderingContext2D, particle: DataParticle) => {
    const currentX = particle.fromX + (particle.toX - particle.fromX) * particle.progress;
    const currentY = particle.fromY + (particle.toY - particle.fromY) * particle.progress;

    // Draw particle glow
    const gradient = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, PARTICLE_SIZE);
    gradient.addColorStop(0, 'rgba(102, 126, 234, 1)');
    gradient.addColorStop(0.7, 'rgba(102, 126, 234, 0.5)');
    gradient.addColorStop(1, 'rgba(102, 126, 234, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(currentX, currentY, PARTICLE_SIZE, 0, Math.PI * 2);
    ctx.fill();

    // Draw bright center
    ctx.fillStyle = '#667eea';
    ctx.beginPath();
    ctx.arc(currentX, currentY, PARTICLE_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  // Create new particle
  const createParticle = () => {
    const connection = simulateDataFlow();
    const fromPos = servicePositions.find(s => s.id === connection.from);
    const toPos = servicePositions.find(s => s.id === connection.to);

    if (!fromPos || !toPos) return;

    const particle: DataParticle = {
      id: `particle_${Date.now()}_${Math.random()}`,
      fromX: fromPos.x + NODE_WIDTH / 2,
      fromY: fromPos.y + NODE_HEIGHT / 2,
      toX: toPos.x + NODE_WIDTH / 2,
      toY: toPos.y + NODE_HEIGHT / 2,
      progress: 0,
      startTime: Date.now(),
    };

    particlesRef.current.push(particle);
  };

  // Update particles
  const updateParticles = () => {
    const now = Date.now();
    particlesRef.current = particlesRef.current.filter(particle => {
      const elapsed = now - particle.startTime;
      particle.progress = Math.min(elapsed / PARTICLE_DURATION, 1);
      return particle.progress < 1;
    });
  };

  // Animation loop
  const animate = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    PIPELINE_CONNECTIONS.forEach(conn => {
      const fromPos = servicePositions.find(s => s.id === conn.from);
      const toPos = servicePositions.find(s => s.id === conn.to);
      if (fromPos && toPos) {
        drawConnection(ctx, fromPos, toPos);
      }
    });

    // Draw particles
    particlesRef.current.forEach(particle => {
      drawParticle(ctx, particle);
    });

    // Draw nodes
    servicePositions.forEach(position => {
      const service = getServiceById(position.id);
      drawNode(ctx, position, service);
    });

    // Update particles
    updateParticles();

    // Continue animation
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Handle canvas click to check if service is clicked
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Check if click is within any service node
    for (const position of servicePositions) {
      if (
        x >= position.x &&
        x <= position.x + NODE_WIDTH &&
        y >= position.y &&
        y <= position.y + NODE_HEIGHT
      ) {
        const service = getServiceById(position.id);
        if (service) {
          console.log('Clicked service:', service);
          // Future: Navigate to service details
        }
        break;
      }
    }
  };

  // Handle mouse move for tooltip
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setMousePos({ x: event.clientX, y: event.clientY });

    // Check if hovering over any service node
    let found = false;
    for (const position of servicePositions) {
      if (
        x >= position.x &&
        x <= position.x + NODE_WIDTH &&
        y >= position.y &&
        y <= position.y + NODE_HEIGHT
      ) {
        const service = getServiceById(position.id);
        if (service && service !== hoveredService) {
          setHoveredService(service);
          found = true;
        }
        break;
      }
    }

    if (!found && hoveredService) {
      setHoveredService(null);
    }
  };

  // Initialize canvas and start animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas size
    canvas.width = 950;
    canvas.height = 400;

    // Start animation
    animate();

    // Create particles periodically
    const particleInterval = setInterval(() => {
      createParticle();
    }, 500);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      clearInterval(particleInterval);
    };
  }, [services]);

  return (
    <Card
      title={t('monitoring.pipelineFlow', 'Pipeline Data Flow')}
      extra={
        <span style={{ fontSize: '0.85rem', color: '#888' }}>
          {t('monitoring.liveVisualization', 'Live Visualization')}
        </span>
      }
    >
      <div style={{ position: 'relative' }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseMove={handleMouseMove}
          style={{
            background: '#0f172a',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
          }}
        />

        {/* Tooltip */}
        {hoveredService && (
          <div
            style={{
              position: 'fixed',
              left: mousePos.x + 15,
              top: mousePos.y + 15,
              background: 'rgba(0, 0, 0, 0.9)',
              color: '#fff',
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid rgba(255, 255, 255, 0.2)',
              fontSize: '0.85rem',
              zIndex: 1000,
              pointerEvents: 'none',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 6 }}>
              {hoveredService.icon} {hoveredService.displayName}
            </div>
            <div style={{ color: '#888', marginBottom: 4 }}>Port: {hoveredService.port}</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <div style={{ color: '#888', fontSize: '0.75rem' }}>CPU</div>
                <div>{hoveredService.cpu}%</div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: '0.75rem' }}>Memory</div>
                <div>{hoveredService.memory}%</div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: '0.75rem' }}>Throughput</div>
                <div>{hoveredService.throughput}/s</div>
              </div>
              <div>
                <div style={{ color: '#888', fontSize: '0.75rem' }}>Latency</div>
                <div>{hoveredService.latency}ms</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default PipelineFlow;
