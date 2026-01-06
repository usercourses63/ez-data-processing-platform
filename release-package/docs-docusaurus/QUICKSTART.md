# Quick Start Guide - Docusaurus Documentation

Get the EZ Platform documentation running in 5 minutes.

## Prerequisites Check

```bash
# Check Node.js version (need 18.0+)
node --version

# Check npm
npm --version
```

Don't have Node.js? Download from: https://nodejs.org/

---

## 🚀 3-Step Quick Start

### Step 1: Install Dependencies

```bash
cd release-package/docs-docusaurus
npm install
```

**Expected output:**
```
added 1500+ packages in 30s
```

### Step 2: Start Development Server

```bash
npm start
```

**Expected output:**
```
[SUCCESS] Docusaurus website is running at: http://localhost:3000
```

### Step 3: Open Browser

Navigate to: **http://localhost:3000**

**You should see:**
- EZ Platform documentation home page
- Navigation sidebar on the left
- Dark/light mode toggle in the top right
- Search bar

---

## ✅ Verification

Check these features work:

1. **Navigation** - Click through sidebar items
2. **Search** - Try searching for "installation"
3. **Dark Mode** - Toggle theme in top-right
4. **Hebrew** - Select עברית from language dropdown
5. **Mobile** - Resize browser to test responsiveness

---

## 🐳 Docker Quick Start (Alternative)

If you prefer Docker:

```bash
# Build and run
docker-compose up -d

# Access at http://localhost:8080
```

Stop when done:
```bash
docker-compose down
```

---

## 📝 Common Issues

### Port 3000 Already in Use

```bash
# Use different port
PORT=3001 npm start
```

### npm install fails

```bash
# Clear npm cache
npm cache clean --force
npm install
```

### Permission errors

```bash
# Linux/Mac - fix permissions
sudo chown -R $USER:$USER .
npm install
```

---

## 🎯 Next Steps

Once running, check out:

1. **[SETUP.md](SETUP.md)** - Complete setup guide
2. **[MIGRATION-SUMMARY.md](MIGRATION-SUMMARY.md)** - Migration details
3. **[README.md](README.md)** - Full documentation

---

## 🚢 Production Deployment

Ready to deploy? Use the automated script:

**Windows:**
```powershell
.\scripts\build-and-deploy.ps1
```

**Linux/Mac:**
```bash
./scripts/build-and-deploy.sh
```

Choose your deployment option:
1. Docker (docker-compose)
2. Kubernetes (kubectl)
3. Static hosting

---

## 📞 Need Help?

- Read [SETUP.md](SETUP.md) for detailed instructions
- Check [Docusaurus docs](https://docusaurus.io/docs)
- Review error messages carefully

---

**Total Time:** 5 minutes
**Difficulty:** Beginner-friendly
**Status:** ✅ Ready to use
