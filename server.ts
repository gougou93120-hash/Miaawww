import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Stripe from 'stripe';

dotenv.config({ path: ".env.local" });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  const getAiApiKey = () => {
    return (process.env.OPENAI_API_KEY || "").trim();
  };

  const getAiModel = () => {
    return (process.env.OPENAI_MODEL || "gpt-4o").trim();
  };

  const callOpenAI = async (body: Record<string, unknown>) => {
    const apiKey = getAiApiKey();
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY manquante côté serveur.");
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = data?.error?.message || `Erreur OpenAI HTTP ${response.status}`;
      throw new Error(message);
    }

    const text = data?.choices?.[0]?.message?.content;
    if (!text || typeof text !== "string") {
      throw new Error("Réponse IA vide ou invalide.");
    }

    return text;
  };

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

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      ai: !!getAiApiKey(),
      aiProvider: "openai",
      aiModel: getAiModel(),
      stripe: !!process.env.STRIPE_SECRET_KEY 
    });
  });

  // AI Analysis Endpoint
  app.post("/api/analyze", async (req, res) => {
    const isAdmin = req.body.email === 'gougou93120@gmail.com';
    console.log(`[ANALYSIS] Request from ${req.body.email} (Admin: ${isAdmin})`);
    
    try {
      if (!getAiApiKey()) {
        console.error("[ANALYSIS ERROR] OPENAI_API_KEY missing");
        return res.status(500).json({ error: "Le serveur n'a pas de clé OpenAI configurée." });
      }

      const { userFrames, refFrames, prompt, systemInstruction } = req.body;

      if (!Array.isArray(userFrames) || !Array.isArray(refFrames) || userFrames.length === 0 || refFrames.length === 0) {
        return res.status(400).json({ error: "Images vidéo manquantes pour l'analyse." });
      }

      const modelToUse = getAiModel();
      console.log(`[ANALYSIS] Attempting OpenAI analysis with: ${modelToUse}`);
      
      const imageContent = [
        { type: "text", text: `${prompt}\n\nLes images suivantes sont des captures extraites de la vidéo de l'élève, puis de la vidéo de référence. Analyse la posture et la technique à partir de cette séquence visuelle.` },
        { type: "text", text: "CAPTURES DE L'ELEVE :" },
        ...userFrames.map((frame: string) => ({
          type: "image_url",
          image_url: { url: frame, detail: "high" },
        })),
        { type: "text", text: "CAPTURES DE LA REFERENCE :" },
        ...refFrames.map((frame: string) => ({
          type: "image_url",
          image_url: { url: frame, detail: "high" },
        })),
      ];

      const text = await callOpenAI({
        model: modelToUse,
        temperature: 0.35,
        max_tokens: 1800,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: imageContent },
        ],
      });

      return res.json({ text });
    } catch (error: any) {
      console.error("[ANALYSIS CRITICAL ERROR]:", error);
      res.status(500).json({ 
        error: "Échec de l'analyse IA.", 
        details: error.message,
        suggestion: "Vérifiez que OPENAI_API_KEY est configurée côté serveur." 
      });
    }
  });

  // AI Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      if (!getAiApiKey()) return res.status(500).json({ error: "Clé OpenAI non configurée." });

      const { messages, systemInstruction } = req.body;
      const text = await callOpenAI({
        model: getAiModel(),
        temperature: 0.45,
        max_tokens: 900,
        messages: [
          { role: "system", content: systemInstruction },
          ...messages.map((message: any) => ({
            role: message.role === "user" ? "user" : "assistant",
            content: message.text,
          })),
        ],
      });

      return res.json({ text });
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
