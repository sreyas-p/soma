# 🚀 Vercel Deployment Guide for Aware AI Agents

## **Overview**
This guide will help you deploy your AI agents backend to Vercel, making them work on TestFlight and production.

## **📋 What We've Created**

### **1. Vercel Serverless Functions**
- `api/chat.js` - Main AI agent chat endpoint
- `api/generate-checklist.js` - Personalized checklist generation
- `api/health.js` - Health check endpoint

### **2. Configuration Files**
- `vercel.json` - Vercel deployment configuration
- Updated `package.json` with required dependencies

## **🚀 Deployment Steps**

### **Step 1: Install Vercel CLI**
```bash
npm install -g vercel
```

### **Step 2: Login to Vercel**
```bash
vercel login
```

### **Step 3: Set Environment Variables**
```bash
# Set your OpenAI API key
vercel env add OPENAI_API_KEY
# Enter your OpenAI API key when prompted
```

### **Step 4: Deploy to Vercel**
```bash
vercel --prod
```

### **Step 5: Update App Configuration**
After deployment, Vercel will give you a URL like:
`https://your-project-name.vercel.app`

Update `src/components/ui/AgentDetailModal.tsx` with your actual Vercel URL:
```typescript
const BACKEND_URLS = [
  'https://your-project-name.vercel.app/api/chat',  // Your Vercel URL
  'http://localhost:3001/chat',  // Local development fallback
];
```

## **🔧 Environment Variables**

### **Required:**
- `OPENAI_API_KEY` - Your OpenAI API key

### **Optional:**
- `NODE_ENV` - Set to "production" for production

## **📱 TestFlight Integration**

### **Before TestFlight:**
1. ✅ Deploy to Vercel
2. ✅ Test AI functionality with Vercel URL
3. ✅ Update app with Vercel URL
4. ✅ Build and test locally

### **After TestFlight:**
- AI agents will work for all users
- Personalized health advice available
- Checklists generated in real-time
- No localhost dependency issues

## **🌐 API Endpoints**

### **Chat Endpoint**
```
POST https://your-project.vercel.app/api/chat
Body: { agent, messages, userContext }
```

### **Checklist Endpoint**
```
POST https://your-project.vercel.app/api/generate-checklist
Body: { userContext }
```

### **Health Check**
```
GET https://your-project.vercel.app/api/health
```

## **🔍 Testing Your Deployment**

### **1. Test Health Endpoint**
```bash
curl https://your-project.vercel.app/api/health
```

### **2. Test Chat Endpoint**
```bash
curl -X POST https://your-project.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"agent":"Nutri","messages":[{"role":"user","content":"Hello"}]}'
```

### **3. Test Checklist Endpoint**
```bash
curl -X POST https://your-project.vercel.app/api/generate-checklist \
  -H "Content-Type: application/json" \
  -d '{"userContext":"I want to improve my nutrition"}'
```

## **💰 Vercel Pricing**

### **Free Tier (Hobby)**
- ✅ 100GB bandwidth/month
- ✅ 100 serverless function executions/day
- ✅ Perfect for testing and small apps

### **Pro Tier ($20/month)**
- ✅ 1TB bandwidth/month
- ✅ 1000 serverless function executions/day
- ✅ Custom domains
- ✅ Team collaboration

## **🚨 Important Notes**

### **Security:**
- ✅ OpenAI API key is stored securely in Vercel
- ✅ CORS enabled for mobile app access
- ✅ No sensitive data exposed in client code

### **Performance:**
- ✅ Serverless functions scale automatically
- ✅ Global CDN for fast response times
- ✅ Cold start optimization for better UX

### **Monitoring:**
- ✅ Vercel dashboard shows function performance
- ✅ Error logs and analytics available
- ✅ Real-time deployment status

## **🔧 Troubleshooting**

### **Common Issues:**

#### **1. Function Timeout**
- Increase `maxDuration` in `vercel.json`
- Optimize OpenAI API calls

#### **2. CORS Errors**
- Check CORS headers in functions
- Verify mobile app URL is allowed

#### **3. Environment Variables**
- Ensure `OPENAI_API_KEY` is set in Vercel
- Redeploy after setting environment variables

#### **4. Function Not Found**
- Check file paths in `api/` folder
- Verify `vercel.json` configuration

## **🎯 Next Steps**

### **Immediate:**
1. Deploy to Vercel
2. Test all endpoints
3. Update app with Vercel URL
4. Test locally

### **Before TestFlight:**
1. Verify AI functionality works
2. Test with real HealthKit data
3. Ensure Supabase integration works
4. Final testing and validation

### **After TestFlight:**
1. Monitor Vercel function performance
2. Track API usage and costs
3. Optimize based on user feedback
4. Scale as needed

## **✅ Success Checklist**

- [ ] Vercel CLI installed and logged in
- [ ] Environment variables set
- [ ] Backend deployed to Vercel
- [ ] All endpoints tested and working
- [ ] App updated with Vercel URL
- [ ] Local testing completed
- [ ] Ready for TestFlight deployment

---

**Your AI agents will now work perfectly on TestFlight with real-time personalized health advice! 🎉**

