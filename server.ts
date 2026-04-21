import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from 'stripe';
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase limit for video payloads
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Stripe initialization with lazy loading pattern
  let stripe: Stripe | null = null;
  const getStripe = () => {
    if (!stripe && process.env.STRIPE_SECRET_KEY) {
      stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
  };

  // AI initialization
  const getAI = () => {
    const key = process.env.GEMINI_API_KEY;
    if (!key) return null;
    return new GoogleGenerativeAI(key);
  };

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      ai: !!process.env.GEMINI_API_KEY,
      stripe: !!process.env.STRIPE_SECRET_KEY 
    });
  });

  // AI Analysis Endpoint
  app.post("/api/analyze", async (req, res) => {
    const isAdmin = req.body.email === 'gougou93120@gmail.com';
    console.log(`[ANALYSIS] Request from ${req.body.email} (Admin: ${isAdmin})`);
    
    try {
      const ai = getAI();
      if (!ai) {
        console.error("[ANALYSIS ERROR] GEMINI_API_KEY missing");
        return res.status(500).json({ error: "Le serveur n'a pas de clé API IA configurée." });
      }

      const { userVideo, refVideo, prompt, model, systemInstruction } = req.body;

      if (!userVideo || !refVideo) {
        return res.status(400).json({ error: "Données vidéo manquantes." });
      }

      // Force high performance for everyone for maximum reliability
      const modelToUse = "gemini-1.5-pro";
      console.log(`[ANALYSIS] Attempting analysis with: ${modelToUse}`);
      
      try {
        const generationModel = ai.getGenerativeModel({ 
          model: modelToUse,
          systemInstruction: systemInstruction 
        });

        const result = await generationModel.generateContent([
          { text: prompt },
          { inlineData: { mimeType: "video/webm", data: userVideo } },
          { inlineData: { mimeType: "video/webm", data: refVideo } }
        ]);

        const response = await result.response;
        return res.json({ text: response.text() });
      } catch (aiError: any) {
        console.warn("[ANALYSIS] Pro model failed, falling back to Flash:", aiError.message);
        // FALLBACK to FLASH if PRO fails (Redundancy)
        const fallbackModel = ai.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          systemInstruction: systemInstruction 
        });
        const result = await fallbackModel.generateContent([
          { text: prompt },
          { inlineData: { mimeType: "video/webm", data: userVideo } },
          { inlineData: { mimeType: "video/webm", data: refVideo } }
        ]);
        const response = await result.response;
        return res.json({ text: response.text() });
      }
    } catch (error: any) {
      console.error("[ANALYSIS CRITICAL ERROR]:", error);
      res.status(500).json({ 
        error: "Échec de l'analyse IA.", 
        details: error.message,
        suggestion: "Vérifiez que la clé API dans 'Secrets' est toujours valide." 
      });
    }
  });

  // AI Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    const isAdmin = req.body.email === 'gougou93120@gmail.com';
    try {
      const ai = getAI();
      if (!ai) return res.status(500).json({ error: "Clé API non configurée." });

      const { messages, systemInstruction } = req.body;
      const modelToUse = "gemini-1.5-pro";
      
      try {
        const generationModel = ai.getGenerativeModel({ 
          model: modelToUse,
          systemInstruction: systemInstruction 
        });

        const chat = generationModel.startChat({
          history: messages.slice(0, -1).map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          }))
        });

        const lastMessage = messages[messages.length - 1].text;
        const result = await chat.sendMessage(lastMessage);
        const response = await result.response;
        return res.json({ text: response.text() });
      } catch (chatError: any) {
        console.warn("[CHAT] Pro model failed, falling back to Flash:", chatError.message);
        const fallbackModel = ai.getGenerativeModel({ 
          model: "gemini-1.5-flash",
          systemInstruction: systemInstruction 
        });
        const chat = fallbackModel.startChat({
          history: messages.slice(0, -1).map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'model',
            parts: [{ text: m.text }]
          }))
        });
        const lastMessage = messages[messages.length - 1].text;
        const result = await chat.sendMessage(lastMessage);
        const response = await result.response;
        return res.json({ text: response.text() });
      }
    } catch (error: any) {
      console.error("[CHAT ERROR]:", error);
      res.status(500).json({ error: "Échec de la discussion IA.", details: error.message });
    }
  });

  // Stripe Checkout Session Endpoint
  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const client = getStripe();
      if (!client) {
        throw new Error("Stripe is not configured. Please add STRIPE_SECRET_KEY.");
      }

      const { email, userId, planType } = req.body;
      const appUrl = process.env.APP_URL || `http://${req.headers.host}`;

      // Choose price ID based on plan type
      const priceId = planType === 'yearly' 
        ? process.env.STRIPE_PRICE_YEARLY_ID 
        : process.env.STRIPE_PRICE_MONTHLY_ID;

      if (!priceId) {
        throw new Error(`Stripe Price ID for ${planType} is not configured.`);
      }

      const session = await client.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        customer_email: email,
        client_reference_id: userId,
        success_url: `${appUrl}?subscription_success=true`,
        cancel_url: `${appUrl}/subscription?cancel=true`,
      });

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Stripe Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
