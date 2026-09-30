# MongoDB Atlas Setup Guide

## Step 1: Create a MongoDB Atlas Account

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Click "Try Free" and sign up with your email or Google account
3. Verify your email address

## Step 2: Create a Free Cluster

1. After login, click "Build a Database"
2. Select **M0 FREE** tier (512 MB storage - perfect for development)
3. Choose your cloud provider: **AWS** (recommended)
4. Select a region closest to you (e.g., Mumbai for India: `ap-south-1`)
5. Name your cluster: `ai-finance-cluster`
6. Click "Create Deployment"

## Step 3: Set Up Database Access

1. Go to **Database Access** in the left sidebar
2. Click "Add New Database User"
3. Authentication Method: **Password**
4. Enter a username: `ai_finance_admin`
5. Click "Autogenerate Secure Password" and **SAVE THIS PASSWORD**
6. Database User Privileges: Select **"Read and write to any database"**
7. Click "Add User"

## Step 4: Set Up Network Access

1. Go to **Network Access** in the left sidebar
2. Click "Add IP Address"
3. For development: Click **"Allow Access from Anywhere"** (0.0.0.0/0)
4. For production: Add your server's specific IP address
5. Click "Confirm"

## Step 5: Get Your Connection String

1. Go to **Database** in the left sidebar
2. Click **"Connect"** on your cluster
3. Select **"Drivers"**
4. Driver: Node.js, Version: 6.0 or later
5. Copy the connection string. It looks like:

```
mongodb+srv://ai_finance_admin:<password>@ai-finance-cluster.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=ai-finance-cluster
```

6. Replace `<password>` with the password you saved in Step 3
7. Add your database name before the `?`:

```
mongodb+srv://ai_finance_admin:YOUR_PASSWORD@ai-finance-cluster.xxxxx.mongodb.net/ai_finance?retryWrites=true&w=majority
```

## Step 6: Add to Your Project

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Paste your connection string as the `MONGODB_URI` value:
   ```
   MONGODB_URI=mongodb+srv://ai_finance_admin:YOUR_PASSWORD@ai-finance-cluster.xxxxx.mongodb.net/ai_finance?retryWrites=true&w=majority
   ```

## Step 7: Verify Connection

Run the server and check the console:
```bash
cd server
npm install
npm run dev
```

You should see: `MongoDB Connected: ai-finance-cluster-shard-00-xx.xxxxx.mongodb.net`

## Optional: Create Indexes for Performance

Connect to your cluster via MongoDB Compass or the Atlas UI shell and run:

```javascript
// Transaction indexes
db.transactions.createIndex({ userId: 1, date: -1 });
db.transactions.createIndex({ userId: 1, category: 1 });
db.transactions.createIndex({ userId: 1, type: 1, date: -1 });
db.transactions.createIndex({ description: "text" });

// User indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ apiKey: 1 });

// Budget indexes
db.budgets.createIndex({ userId: 1, isActive: 1 });

// Notification indexes
db.notifications.createIndex({ userId: 1, isRead: 1, createdAt: -1 });
```

## Troubleshooting

**"MongoServerError: bad auth"**
- Double-check your password (no special characters that need URL-encoding)
- If password has `@`, `#`, `%`, etc., URL-encode them

**"MongoNetworkError: connection timed out"**
- Check Network Access: your IP must be whitelisted
- Try "Allow Access from Anywhere" for testing

**"ENOTFOUND" error**
- Check your cluster hostname in the connection string
- Ensure DNS resolution works (try Google DNS: 8.8.8.8)
