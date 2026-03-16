/**
 * NAS Device Modal Component for Creating/Editing NAS Devices
 * v0.2.0: NAS/NFS Architecture Support
 */
import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Divider,
  message,
  Space,
  Typography,
} from 'antd';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NasDevice, CreateNasDeviceRequest, UpdateNasDeviceRequest, NasDeviceRole } from '../../../services/nas-devices-api-client';
import { createNasDevice, updateNasDevice } from '../../../services/nas-devices-api-client';

const { Option } = Select;
const { TextArea } = Input;

interface NasDeviceModalProps {
  visible: boolean;
  device: NasDevice | null;
  onClose: () => void;
  onSuccess: () => void;
}

// Default NFS mount options
const DEFAULT_MOUNT_OPTIONS = ['nfsvers=4', 'nolock'];

const NasDeviceModal: React.FC<NasDeviceModalProps> = ({
  visible,
  device,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const isEditing = !!device;

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createNasDevice,
    onSuccess: () => {
      message.success(t('admin.nas.createSuccess') || 'NAS device created successfully');
      onSuccess();
    },
    onError: (error: Error) => {
      message.error(error.message || t('admin.nas.createError') || 'Error creating NAS device');
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNasDeviceRequest }) =>
      updateNasDevice(id, data),
    onSuccess: () => {
      message.success(t('admin.nas.updateSuccess') || 'NAS device updated successfully');
      onSuccess();
    },
    onError: (error: Error) => {
      message.error(error.message || t('admin.nas.updateError') || 'Error updating NAS device');
    },
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (visible) {
      if (device) {
        form.setFieldsValue({
          Name: device.Name,
          Description: device.Description,
          Host: device.Host,
          Port: device.Port,
          ExportPath: device.ExportPath,
          Role: device.Role,
          StorageCapacity: device.StorageCapacity,
          AccessMode: device.AccessMode,
          ReclaimPolicy: device.ReclaimPolicy,
          MountOptions: device.MountOptions || DEFAULT_MOUNT_OPTIONS,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({
          Port: 2049,
          ExportPath: '/data',
          Role: 'Input',
          StorageCapacity: '10Gi',
          AccessMode: 'ReadWriteMany',
          ReclaimPolicy: 'Retain',
          MountOptions: DEFAULT_MOUNT_OPTIONS,
        });
      }
    }
  }, [visible, device, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      const requestData: CreateNasDeviceRequest = {
        Name: values.Name,
        Description: values.Description,
        Host: values.Host,
        Port: values.Port,
        ExportPath: values.ExportPath,
        Role: values.Role as NasDeviceRole,
        StorageCapacity: values.StorageCapacity,
        AccessMode: values.AccessMode,
        ReclaimPolicy: values.ReclaimPolicy,
        MountOptions: values.MountOptions,
      };

      if (isEditing) {
        updateMutation.mutate({ id: device.ID, data: requestData });
      } else {
        createMutation.mutate(requestData);
      }
    } catch {
      // Form validation failed
    }
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Modal
      title={isEditing
        ? (t('admin.nas.editDevice') || 'Edit NAS Device')
        : (t('admin.nas.addDevice') || 'Add NAS Device')
      }
      open={visible}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={isLoading}
      okText={isEditing ? (t('common.save') || 'Save') : (t('common.create') || 'Create')}
      cancelText={t('common.cancel') || 'Cancel'}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
      >
        {/* Basic Info */}
        <Form.Item
          name="Name"
          label={t('admin.nas.fields.name') || 'Name'}
          rules={[
            { required: true, message: t('errors.required') || 'Name is required' },
            { max: 100, message: t('errors.maxLength', { max: 100 }) || 'Max 100 characters' },
          ]}
        >
          <Input placeholder="Production NAS" />
        </Form.Item>

        <Form.Item
          name="Description"
          label={t('admin.nas.fields.description') || 'Description'}
        >
          <TextArea rows={2} placeholder={t('admin.nas.placeholders.description') || 'Optional description'} />
        </Form.Item>

        <Divider>{t('admin.nas.sections.connection') || 'Connection Settings'}</Divider>

        <Space style={{ width: '100%' }} size="middle">
          <Form.Item
            name="Host"
            label={t('admin.nas.fields.host') || 'Host'}
            rules={[{ required: true, message: t('errors.required') || 'Host is required' }]}
            style={{ flex: 2 }}
          >
            <Input className="ltr-field" placeholder="192.168.1.100 or nas.example.com" />
          </Form.Item>

          <Form.Item
            name="Port"
            label={t('admin.nas.fields.port') || 'Port'}
            style={{ flex: 1 }}
          >
            <InputNumber
              className="ltr-field"
              min={1}
              max={65535}
              style={{ width: '100%' }}
              placeholder="2049"
            />
          </Form.Item>
        </Space>

        <Form.Item
          name="ExportPath"
          label={t('admin.nas.fields.exportPath') || 'Export Path'}
          rules={[{ required: true, message: t('errors.required') || 'Export path is required' }]}
        >
          <Input className="ltr-field" placeholder="/data or /exports/share1" />
        </Form.Item>

        <Form.Item
          name="Role"
          label={t('admin.nas.fields.role') || 'Role'}
          rules={[{ required: true, message: t('errors.required') || 'Role is required' }]}
        >
          <Select>
            <Option value="Input">{t('admin.nas.roles.Input') || 'Input'}</Option>
            <Option value="Output">{t('admin.nas.roles.Output') || 'Output'}</Option>
            <Option value="Backup">{t('admin.nas.roles.Backup') || 'Backup'}</Option>
            <Option value="Both">{t('admin.nas.roles.Both') || 'Both (Input + Output)'}</Option>
          </Select>
        </Form.Item>

        <Divider>{t('admin.nas.sections.storage') || 'Storage Configuration'}</Divider>

        <Space style={{ width: '100%' }} size="middle">
          <Form.Item
            name="StorageCapacity"
            label={t('admin.nas.fields.storageCapacity') || 'Storage Capacity'}
            style={{ flex: 1 }}
            rules={[{ required: true, message: t('errors.required') || 'Capacity is required' }]}
          >
            <Input className="ltr-field" placeholder="10Gi" />
          </Form.Item>

          <Form.Item
            name="AccessMode"
            label={t('admin.nas.fields.accessMode') || 'Access Mode'}
            style={{ flex: 1 }}
          >
            <Select>
              <Option value="ReadWriteMany">ReadWriteMany (RWX)</Option>
              <Option value="ReadOnlyMany">ReadOnlyMany (ROX)</Option>
              <Option value="ReadWriteOnce">ReadWriteOnce (RWO)</Option>
            </Select>
          </Form.Item>
        </Space>

        <Form.Item
          name="ReclaimPolicy"
          label={t('admin.nas.fields.reclaimPolicy') || 'Reclaim Policy'}
        >
          <Select>
            <Option value="Retain">{t('admin.nas.reclaimPolicies.Retain') || 'Retain (Keep data)'}</Option>
            <Option value="Delete">{t('admin.nas.reclaimPolicies.Delete') || 'Delete (Remove data)'}</Option>
            <Option value="Recycle">{t('admin.nas.reclaimPolicies.Recycle') || 'Recycle (Scrub and reuse)'}</Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="MountOptions"
          label={t('admin.nas.fields.mountOptions') || 'Mount Options'}
        >
          <Select
            mode="tags"
            style={{ width: '100%' }}
            placeholder={t('admin.nas.placeholders.mountOptions') || 'nfsvers=4, nolock'}
            tokenSeparators={[',']}
          >
            <Option value="nfsvers=4">nfsvers=4</Option>
            <Option value="nfsvers=3">nfsvers=3</Option>
            <Option value="tcp">tcp</Option>
            <Option value="hard">hard</Option>
            <Option value="soft">soft</Option>
            <Option value="intr">intr</Option>
            <Option value="nolock">nolock</Option>
            <Option value="rsize=8192">rsize=8192</Option>
            <Option value="wsize=8192">wsize=8192</Option>
          </Select>
        </Form.Item>

        <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
          {t('admin.nas.note') || 'Note: After saving, use the Provision button to create Kubernetes PV/PVC resources.'}
        </Typography.Text>
      </Form>
    </Modal>
  );
};

export default NasDeviceModal;
