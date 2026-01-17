# Quick Start Guide After Fixes

All critical issues have been fixed! Follow these steps to get your application running:

## 1. Setup Environment Variables (5 minutes)

```bash
cd backend
cp .env.example .env
```

Then edit `.env` and set:
```bash
SECRET_KEY=<generate with: openssl rand -hex 32>
GEMINI_API_KEY=<your actual API key>
```

Optional but recommended:
```bash
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-secure-password
TELEGRAM_BOT_TOKEN=<if you have one>
CHAPA_SECRET_KEY=<if you have one>
```

## 2. Migrate Existing Database (2 minutes)

**If you have an existing database:**
```bash
cd backend
python migrate_fix_data_types.py
```

**If starting fresh:**
```bash
# Delete old database if it exists
rm ethiolex.db
# New schema will be created automatically on startup
```

## 3. Start Backend (1 minute)

```bash
cd backend
python main.py
```

You should see:
- ✅ Environment validation passes
- ✅ Server starts on port 8001
- ✅ No errors

## 4. Start Frontend

```bash
# In a new terminal
npm run dev
```

## 5. Test Everything

### Test Authentication:
1. Register a new user
2. Check console for verification codes (not in API response anymore!)
3. Verify email and phone
4. Login

### Test Admin (if you set ADMIN_EMAIL/PASSWORD):
1. Login with admin credentials
2. Navigate to admin dashboard
3. Verify you can see stats

### Test Payments:
1. Try to initialize a payment
2. Verify amount is processed correctly

## Troubleshooting

### "SECRET_KEY not set" error
➜ Make sure you have `.env` file with SECRET_KEY set

### "Port 8001 already in use"
➜ Run: `netstat -ano | findstr :8001` (Windows) or `lsof -i :8001` (Mac/Linux)
➜ Kill the process using that port

### "Migration failed"
➜ Check that ethiolex.db exists and is not locked by another process
➜ Your backup is safe at `ethiolex_backup_<timestamp>.db`

### Database schema errors
➜ Delete `ethiolex.db` and restart (fresh start)
➜ Or restore from backup and try migration again

## What Changed?

See `FIXES_APPLIED.md` for complete details. Key changes:
- ✅ Security: Verification codes no longer exposed
- ✅ Security: SECRET_KEY validation enforced
- ✅ Data: Boolean types instead of strings
- ✅ Data: Float for payment amounts
- ✅ Data: Proper verification logic (NULL = verified)
- ✅ Fixed admin authorization bug
- ✅ Removed duplicate code

## Need Help?

1. Check `FIXES_APPLIED.md` for detailed documentation
2. Check console logs for specific errors
3. Verify all environment variables are set correctly
