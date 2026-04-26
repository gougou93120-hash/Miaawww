/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Shield, 
  Wind, 
  Target, 
  Brain, 
  Play, 
  Upload, 
  ChevronRight,
  Menu, 
  X, 
  Activity,
  Video,
  Zap,
  Info,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Award,
  Send,
  Footprints,
  LogOut,
  LogIn,
  User as UserIcon,
  Dumbbell,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronLeft,
  History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { compressVideo } from './lib/videoCompression';
import { CHAPTERS, Language } from './constants';
import { TRANSLATIONS } from './translations';
import { cn } from './lib/utils';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  db, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  arrayUnion,
  FirebaseUser, 
  handleFirestoreError, 
  OperationType 
} from './firebase';

// --- Types ---
type View = 'dashboard' | 'chapters' | 'analysis' | 'bivol' | 'subscription' | 'history';

// --- Components ---

const IconMap: Record<string, any> = {
  Shield,
  Wind,
  Target,
  Brain,
  Activity,
  Zap,
  Award,
  Footprints
};

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string | null>(null);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setHasError(true);
      setErrorInfo(event.message);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    let displayMessage = "Une erreur critique est survenue.";
    try {
      const parsed = JSON.parse(errorInfo || '');
      if (parsed.error && parsed.operationType) {
        displayMessage = `Erreur de base de données (${parsed.operationType}) : ${parsed.error}`;
      }
    } catch (e) {
      displayMessage = errorInfo || displayMessage;
    }

    return (
      <div className="min-h-screen bg-soviet-dark flex items-center justify-center p-8 text-center">
        <div className="soviet-card max-w-md space-y-6 border-soviet-red">
          <AlertCircle size={64} className="text-soviet-red mx-auto" />
          <h1 className="text-3xl font-display font-black uppercase italic">Système Interrompu</h1>
          <p className="opacity-70 font-mono text-sm">{displayMessage}</p>
          <button 
            onClick={() => window.location.reload()}
            className="soviet-button soviet-button-primary w-full"
          >
            Réinitialiser le Système
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// --- Main App ---

interface HistoryEntry {
  id: string;
  date: string;
  targetBoxer: string;
  result: string;
}

export default function App() {
  const [lang, setLang] = useState<Language>('fr');
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedChapter, setSelectedChapter] = useState(CHAPTERS['fr'][0]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [showOptimizationGuide, setShowOptimizationGuide] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  // Auth & API Key
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);

  const t = TRANSLATIONS[lang];

  // Check for API Key
  useEffect(() => {
    const checkKey = async () => {
      try {
        // Check server health first
        const res = await fetch('/api/health');
        const health = await res.json();
        
        if (health.ai) {
          setHasApiKey(true);
          return;
        }

        // Fallback to local platform check if server doesn't have it
        if ((window as any).aistudio?.hasSelectedApiKey) {
          const selected = await (window as any).aistudio.hasSelectedApiKey();
          setHasApiKey(selected || !!process.env.GEMINI_API_KEY);
        } else {
          setHasApiKey(!!process.env.GEMINI_API_KEY);
        }
      } catch (e) {
        setHasApiKey(!!process.env.GEMINI_API_KEY);
      }
    };
    checkKey();
    
    // Auto-selected key listener if platform supports it
    const timer = setInterval(checkKey, 5000);
    return () => clearInterval(timer);
  }, []);

  const testApiKey = async () => {
    try {
      addLog("TEST IA: Envoi d'un message court...");
      const apiKey = getActiveApiKey();
      if (!apiKey || apiKey === "undefined") {
        throw new Error("Clé API non détectée.");
      }
      
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({
        model: "gemini-1.5-flash",
      });
      const result = await model.generateContent("Dis 'Prêt' en français.");
      const response = await result.response;
      const text = response.text();
      
      if (text) {
        addLog(`TEST RÉUSSI: L'IA a répondu: "${text}"`);
        setError(null);
        setHasApiKey(true);
      } else {
        throw new Error("Réponse vide de l'IA.");
      }
    } catch (err: any) {
      console.error("Test API Error:", err);
      const rawError = err.message || JSON.stringify(err);
      addLog(`TEST ÉCHOUÉ: ${rawError}`);
      setError(`DÉTAIL ERREUR GOOGLE: ${rawError}`);
      setHasApiKey(false);
    }
  };

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      try {
        addLog("SYSTÈME: Ouverture du sélecteur de clé...");
        await (window as any).aistudio.openSelectKey();
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected || !!process.env.GEMINI_API_KEY);
        if (selected || process.env.GEMINI_API_KEY) {
          setError(null);
          addLog("SUCCÈS: IA Reconnectée.");
        }
      } catch (e) {
        console.error("Error selecting key:", e);
      }
    } else {
      alert("Veuillez configurer GEMINI_API_KEY dans l'onglet 'Secrets' (⚙️) puis REPUBLIER l'application.");
    }
  };

  // Detect Standalone & iOS
  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    setIsStandalone(isStandaloneMode);
  }, []);

  // Auth & Subscription Sync
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      const isAdminByEmail = firebaseUser?.email === 'gougou93120@gmail.com';
      
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        // Handle subscription success from URL
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('subscription_success') === 'true') {
          try {
            await setDoc(userDocRef, { isSubscribed: true, updatedAt: new Date().toISOString() }, { merge: true });
            setIsSubscribed(true);
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (e) {
            console.error("Error updating subscription:", e);
          }
        }

        try {
          const userDoc = await getDoc(userDocRef);
          
          if (!userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL,
              role: isAdminByEmail ? 'admin' : 'user',
              isSubscribed: false,
              createdAt: new Date().toISOString()
            });
            setIsAdmin(isAdminByEmail);
          } else {
            const data = userDoc.data();
            setIsSubscribed(data.isSubscribed || false);
            setFreeAnalysesUsed(data.freeAnalysesUsed || 0);
            setIsAdmin(data.role === 'admin' || isAdminByEmail);
          }
        } catch (error) {
          // If Firestore fails, at least grant Admin permission locally if email matches
          console.error("Auth sync error:", error);
          if (isAdminByEmail) setIsAdmin(true);
        }

        // Fetch History from Firestore - MERGE with locale if exists
        try {
          const historyRef = doc(db, 'history', firebaseUser.uid);
          const historyDoc = await getDoc(historyRef);
          if (historyDoc.exists()) {
            const serverEntries = historyDoc.data().entries || [];
            // Preserve locally created entries during this session if sync was slow
            setHistory(prev => {
              const existingIds = new Set(prev.map(e => e.id));
              const missingFromServer = serverEntries.filter((e: any) => !existingIds.has(e.id));
              return [...prev, ...missingFromServer];
            });
          }
        } catch (e) {
          console.error("Error fetching history:", e);
        }

      } else {
        setIsAdmin(false);
        setIsSubscribed(false);
        setHistory([]);
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // PWA Prompt
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  // Trial & Subscription
  const [trialStartDate, setTrialStartDate] = useState<number | null>(() => {
    const saved = localStorage.getItem('soviet_boxing_trial_start_v3');
    const parsed = saved ? parseInt(saved) : null;
    return (parsed && !isNaN(parsed)) ? parsed : null;
  });
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [freeAnalysesUsed, setFreeAnalysesUsed] = useState<number>(() => {
    const saved = localStorage.getItem('soviet_boxing_free_used_v2');
    return saved ? parseInt(saved) : 0;
  });
  const [timeLeft, setTimeLeft] = useState({ hours: 24, minutes: 0 });

  // Sync free used
  useEffect(() => {
    localStorage.setItem('soviet_boxing_free_used_v2', freeAnalysesUsed.toString());
  }, [freeAnalysesUsed]);

  useEffect(() => {
    const storedStart = localStorage.getItem('soviet_boxing_trial_start_v3');
    const now = Date.now();
    if (storedStart) {
      const parsed = parseInt(storedStart);
      if (!isNaN(parsed)) setTrialStartDate(parsed);
    } else if (user) {
      // Only start the clock if they are logged in and NOT admin/sub
      if (user.email !== OWNER_EMAIL && !isAdmin && !isSubscribed) {
        localStorage.setItem('soviet_boxing_trial_start_v3', now.toString());
        setTrialStartDate(now);
      }
    }
    const storedSub = localStorage.getItem('soviet_boxing_subscribed');
    if (storedSub === 'true') setIsSubscribed(true);
  }, [user, isAdmin, isSubscribed]);

  useEffect(() => {
    if (!trialStartDate || isSubscribed || isAdmin) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = (trialStartDate + 24 * 60 * 60 * 1000) - now;
      if (diff <= 0) {
        setTimeLeft({ hours: 0, minutes: 0 });
        clearInterval(timer);
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft({ hours: h, minutes: m });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [trialStartDate, isSubscribed, isAdmin]);

  const isTrialExpired = (trialStartDate && !isAdmin && !isSubscribed) 
    ? (Date.now() > trialStartDate + 24 * 60 * 60 * 1000) 
    : false;

  const FREE_LIMIT = 2;
  const OWNER_EMAIL = 'gougou93120@gmail.com';
  const hasFreeAnalyses = freeAnalysesUsed < FREE_LIMIT;
  
  // CRITICAL FIX: Only block if auth is ready. 
  // Owner/Admin/Subscribed have total freedom.
  const isDirectAdmin = user?.email === OWNER_EMAIL;
  const hasAccess = !isAuthReady || (isDirectAdmin || isAdmin || isSubscribed || (hasFreeAnalyses && !isTrialExpired));

  // Analysis State
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [userVideo, setUserVideo] = useState<string | null>(null);
  const [userVideoFile, setUserVideoFile] = useState<File | null>(null);
  const [refVideo, setRefVideo] = useState<string | null>(null);
  const [refVideoFile, setRefVideoFile] = useState<File | null>(null);
  const [targetBoxer, setTargetBoxer] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCompressing, setIsCompressing] = useState<string | null>(null);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isCheckingSubscription, setIsCheckingSubscription] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setDebugLog(prev => [msg, ...prev].slice(0, 5));
  };

  // Chat State
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([]);
  const [userQuestion, setUserQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const chatRef = useRef<any>(null);

  const userVideoRef = useRef<HTMLInputElement>(null);
  const refVideoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('soviet_boxing_history', JSON.stringify(history));
  }, [history]);

  // --- Handlers ---

  const handleLogin = async () => {
    setError(null);
    try { 
      await signInWithPopup(auth, googleProvider); 
    } catch (e: any) { 
      console.error(e);
      let errorMsg = "Erreur de connexion.";
      if (e.code === 'auth/popup-blocked') {
        errorMsg = "Le popup de connexion a été bloqué par votre navigateur. Veuillez autoriser les popups pour ce site.";
      } else if (e.code === 'auth/unauthorized-domain') {
        errorMsg = `Ce domaine (${window.location.hostname}) n'est pas autorisé dans la console Firebase. Veuillez l'ajouter aux 'Domaines autorisés' dans Authentication > Settings.`;
      } else if (e.code === 'auth/operation-not-allowed') {
        errorMsg = "La connexion Google n'est pas activée dans votre console Firebase. Activez-la dans Authentication > Sign-in method.";
      } else if (e.code === 'auth/popup-closed-by-user') {
        errorMsg = "Connexion annulée.";
      } else if (e.message) {
        errorMsg = `Erreur: ${e.message}`;
      }
      setError(errorMsg);
    }
  };

  const handleLogout = async () => {
    try { await signOut(auth); setCurrentView('dashboard'); } catch (e) { console.error(e); }
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const handleRefresh = async () => {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) await registration.unregister();
    }
    localStorage.clear();
    window.location.reload();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'user' | 'ref') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isLargeFile = file.size > 20 * 1024 * 1024;
    
    if (file.size > 500 * 1024 * 1024) {
      addLog(`ERREUR: Fichier trop lourd (${(file.size / 1024 / 1024).toFixed(1)}Mo)`);
      setError(lang === 'fr' ? "Fichier dépassant 500Mo" : "File exceeds 500MB");
      return;
    }

    addLog(`Chargement: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}Mo)`);

    if (!file.type.startsWith('video/')) {
      addLog("ERREUR: Type de fichier non supporté");
      setError(lang === 'fr' ? "Le fichier doit être une vidéo." : "File must be a video.");
      return;
    }

    let finalFile = file;
    let finalUrl = URL.createObjectURL(file);

    if (isLargeFile) {
      setIsCompressing(type === 'user' ? 'Utilisateur' : 'Maître');
      setCompressionProgress(0);
      try {
        addLog(`OPTIMISATION: Réduction de la charge utile pour "${file.name}"...`);
        const compressedBlob = await compressVideo(file, {
          onProgress: (p) => setCompressionProgress(p)
        });
        finalFile = new File([compressedBlob], file.name, { type: 'video/webm' });
        finalUrl = URL.createObjectURL(compressedBlob);
        addLog(`SUCCÈS: Format optimisé (${(finalFile.size / 1024 / 1024).toFixed(1)}Mo)`);
      } catch (err) {
        console.error(err);
        addLog("AVERTISSEMENT: Échec de l'optimisation, utilisation du fichier original.");
      } finally {
        setIsCompressing(null);
      }
    }

    if (type === 'user') {
      if (userVideo) URL.revokeObjectURL(userVideo);
      setUserVideo(finalUrl);
      setUserVideoFile(finalFile);
    } else {
      if (refVideo) URL.revokeObjectURL(refVideo);
      setRefVideo(finalUrl);
      setRefVideoFile(finalFile);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const getActiveApiKey = (): string => {
    const key = process.env.GEMINI_API_KEY || "";
    return key.trim();
  };

  const runAnalysis = async () => {
    if (!hasAccess) { setCurrentView('subscription'); return; }
    if (!userVideoFile || !refVideoFile) { setError(t.errorVideos); return; }

    const apiKey = getActiveApiKey();
    if (!apiKey) {
      setError("Clé API manquante ou invalide. Veuillez configurer votre clé dans 'Secrets' (⚙️) ou via le bouton 'TESTER' ci-dessous.");
      setHasApiKey(false);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);
    setChatMessages([]);
    chatRef.current = null;
    setAnalysisStep(0);

    const steps = [0, 1, 2, 3];
    const stepInterval = setInterval(() => {
      setAnalysisStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 4000);

    const maxRetries = 3;
    let attempt = 0;

    const performAnalysis = async () => {
      try {
        // Force the BEST model for EVERYONE to ensure maximum satisfaction and reliability
        const modelName = "gemini-1.5-pro"; 

        const userVideoBase64 = await fileToBase64(userVideoFile);
        const refVideoBase64 = await fileToBase64(refVideoFile);
        const totalPayloadSize = userVideoBase64.length + refVideoBase64.length;
        
        // Higher production limits for Subscribed/Admin
        const sizeLimit = isSubscribed || isAdmin ? 200 * 1024 * 1024 : 60 * 1024 * 1024;
        
        if (totalPayloadSize > sizeLimit) {
          addLog("ERREUR: Payload trop lourd");
          throw new Error(lang === 'fr' 
            ? `Le total des vidéos (${(totalPayloadSize / 1024 / 1024).toFixed(1)}MB) dépasse la limite de ${isSubscribed || isAdmin ? '100MB' : '60MB'}.` 
            : `Total video size (${(totalPayloadSize / 1024 / 1024).toFixed(1)}MB) exceeds the ${isSubscribed || isAdmin ? '100MB' : '60MB'} limit.`);
        }

        const historyContext = history
          .slice(-10) 
          .map(h => `--- ANALYSE DU ${h.date} (Cible: ${h.targetBoxer}) ---\nRESULTAT: ${h.result}`)
          .join('\n\n');

        const promptMap = {
          fr: `Analyse technique comparative approfondie de boxe style soviétique.

                CONTEXTE DE PROGRESSION (HISTORIQUE) :
                ${historyContext || "Aucun historique disponible. C'est la première analyse."}

                IMPORTANT : Le boxeur à analyser spécifiquement dans les vidéos est : "${targetBoxer || 'le boxeur principal'}".

                OBJECTIF :
                Compare la vidéo de l'élève à la vidéo de référence. Donne un diagnostic exploitable immédiatement par un boxeur qui veut progresser. Si un détail n'est pas clairement visible, dis-le franchement au lieu d'inventer.

                FORMAT OBLIGATOIRE DU RAPPORT, EN FRANÇAIS CLAIR :
                # Rapport d'analyse technique

                ## Note globale : XX/100
                - Donne une note réaliste entre 0 et 100.
                - Justifie la note en 2 phrases maximum.
                - La note doit prendre en compte : garde, équilibre, déplacements, distance, relâchement, coordination, timing, défense et ressemblance avec la référence.

                ## Résumé express
                Rédige 3 à 5 phrases simples : niveau actuel, qualité principale, priorité numéro 1.

                ## 3 points forts
                Donne exactement 3 points forts numérotés.
                Pour chaque point :
                - nom du point fort ;
                - preuve observée dans la vidéo ;
                - comment l'utiliser encore mieux.

                ## 3 plus grosses erreurs à corriger
                Donne exactement 3 erreurs prioritaires numérotées, de la plus urgente à la moins urgente.
                Pour chaque erreur :
                - problème observé ;
                - conséquence en combat ;
                - correction technique concrète ;
                - exercice recommandé.

                ## Plan d'entraînement personnalisé
                Propose un plan simple sur 7 jours adapté aux erreurs observées.
                Pour chaque jour : objectif, 2 à 3 exercices, durée conseillée, critère de réussite.

                ## Objectif de la prochaine vidéo
                Donne un seul objectif mesurable à filmer lors de la prochaine analyse.

                CONTRAINTES DE STYLE :
                - Réponds uniquement en français.
                - Sois précis, direct, encourageant et facile à comprendre.
                - Utilise du Markdown propre avec titres et listes.
                - Ne dépasse pas 900 mots.
                - Ne parle pas de limites techniques ou d'IA sauf si la vidéo est vraiment impossible à analyser.`,
          en: `In-depth comparative technical analysis of Soviet-style boxing.

                PROGRESSION CONTEXT (HISTORY):
                ${historyContext || "No history available. This is the first analysis."}

                IMPORTANT: The boxer to be specifically analyzed in the videos is: "${targetBoxer || 'the main boxer'}".

                GOAL:
                Compare the student's video with the reference video. Give a practical diagnosis that the boxer can use immediately. If a detail is not clearly visible, say so instead of inventing it.

                MANDATORY REPORT FORMAT, IN CLEAR ENGLISH:
                # Technical analysis report

                ## Global score: XX/100
                - Give a realistic score between 0 and 100.
                - Justify the score in 2 sentences maximum.
                - Consider guard, balance, footwork, distance, relaxation, coordination, timing, defense, and similarity to the reference.

                ## Express summary
                Write 3 to 5 simple sentences: current level, main quality, number 1 priority.

                ## 3 strengths
                Give exactly 3 numbered strengths.
                For each strength: name it, cite visible evidence, explain how to use it better.

                ## 3 biggest mistakes to fix
                Give exactly 3 numbered priority mistakes, from most urgent to least urgent.
                For each mistake: observed problem, combat consequence, concrete technical correction, recommended drill.

                ## Personalized training plan
                Propose a simple 7-day plan adapted to the observed mistakes.
                For each day: objective, 2 to 3 drills, suggested duration, success criterion.

                ## Next video objective
                Give one measurable objective to film for the next analysis.

                STYLE CONSTRAINTS:
                - Answer only in English.
                - Be precise, direct, encouraging, and easy to understand.
                - Use clean Markdown with headings and lists.
                - Stay under 900 words.
                - Do not discuss AI or technical limitations unless the video is truly impossible to analyze.`,
          es: `Análisis técnico comparativo profundo de boxeo estilo soviético.

                CONTEXTO DE PROGRESIÓN (HISTORIAL):
                ${historyContext || "No hay historial disponible. Este es el primer análisis."}

                IMPORTANTE: El boxeador a analizar específicamente en los videos es: "${targetBoxer || 'el boxeador principal'}".

                OBJETIVO:
                Compara el video del alumno con el video de referencia. Da un diagnóstico práctico que el boxeador pueda usar inmediatamente. Si un detalle no se ve claramente, dilo en vez de inventarlo.

                FORMATO OBLIGATORIO DEL INFORME, EN ESPAÑOL CLARO:
                # Informe de análisis técnico

                ## Nota global: XX/100
                - Da una nota realista entre 0 y 100.
                - Justifica la nota en 2 frases máximo.
                - Considera guardia, equilibrio, desplazamientos, distancia, relajación, coordinación, timing, defensa y semejanza con la referencia.

                ## Resumen express
                Escribe 3 a 5 frases simples: nivel actual, principal cualidad, prioridad número 1.

                ## 3 puntos fuertes
                Da exactamente 3 puntos fuertes numerados.
                Para cada punto: nombre, prueba visible, cómo usarlo mejor.

                ## 3 errores más importantes a corregir
                Da exactamente 3 errores prioritarios numerados, del más urgente al menos urgente.
                Para cada error: problema observado, consecuencia en combate, corrección técnica concreta, ejercicio recomendado.

                ## Plan de entrenamiento personalizado
                Propón un plan simple de 7 días adaptado a los errores observados.
                Para cada día: objetivo, 2 a 3 ejercicios, duración aconsejada, criterio de éxito.

                ## Objetivo del próximo video
                Da un solo objetivo medible para filmar en el próximo análisis.

                RESTRICCIONES DE ESTILO:
                - Responde solo en español.
                - Sé preciso, directo, alentador y fácil de entender.
                - Usa Markdown limpio con títulos y listas.
                - No superes 900 palabras.
                - No hables de IA o límites técnicos salvo si el video es realmente imposible de analizar.`
        };

        const systemInstructionMap = {
          fr: "Tu es un coach expert en boxe de l'école soviétique et en analyse biomécanique vidéo. Tu dois fournir un rapport structuré, concret et actionnable. Respecte strictement le format demandé par l'utilisateur : note globale sur 100, exactement 3 points forts, exactement 3 erreurs prioritaires, plan d'entraînement personnalisé et objectif mesurable. Réponds en français clair, avec un ton professionnel, précis et encourageant.",
          en: "You are an expert Soviet-school boxing coach and video biomechanics analyst. Provide a structured, concrete, actionable report. Strictly follow the requested format: global score out of 100, exactly 3 strengths, exactly 3 priority mistakes, personalized training plan, and measurable objective. Answer in clear English with a professional, precise, encouraging tone.",
          es: "Eres un entrenador experto en boxeo de la escuela soviética y en análisis biomecánico por video. Proporciona un informe estructurado, concreto y accionable. Respeta estrictamente el formato pedido: nota global sobre 100, exactamente 3 puntos fuertes, exactamente 3 errores prioritarios, plan de entrenamiento personalizado y objetivo medible. Responde en español claro, con tono profesional, preciso y alentador."
        };

        addLog(`IA INITIALISATION: [Sur Serveur]`);
        
        const resAnalyze = await fetch('/api/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userVideo: userVideoBase64,
            refVideo: refVideoBase64,
            prompt: promptMap[lang],
            model: modelName,
            systemInstruction: systemInstructionMap[lang]
          })
        });

        if (!resAnalyze.ok) {
          const errorData = await resAnalyze.json();
          throw new Error(errorData.error || "Erreur lors de l'analyse serveur.");
        }

        const data = await resAnalyze.json();
        
        if (!data.text) throw new Error("L'IA n'a pas pu générer de réponse.");
        addLog("Analyse terminée avec succès.");
        setAnalysisStep(4);
        setAnalysisResult(data.text);
        
        // Save to Firestore History & Update Counter
        if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          const historyDocRef = doc(db, 'history', user.uid);
          
          const newEntry: HistoryEntry = {
            id: Date.now().toString(),
            date: new Date().toLocaleDateString(),
            targetBoxer: targetBoxer || 'Boxeur',
            result: data.text
          };
          
          // Local update (append to end so it's consistent with arrayUnion)
          setHistory(prev => [...prev, newEntry]);
          
          try {
            // Use arrayUnion to append to the document without overwriting previous data
            await setDoc(historyDocRef, {
              entries: arrayUnion(newEntry),
              updatedAt: new Date().toISOString()
            }, { merge: true });

            if (!isSubscribed && !isAdmin) {
              const newCount = freeAnalysesUsed + 1;
              await setDoc(userDocRef, { freeAnalysesUsed: newCount }, { merge: true });
              setFreeAnalysesUsed(newCount);
            }
          } catch (e) {
            console.error("Error saving history:", e);
          }
        }
        
        setQuotaExceeded(false);
      } catch (err: any) {
        const msg = err.message || "";
        addLog(`ERREUR IA: ${msg.substring(0, 30)}...`);
        
        attempt++;
        if (attempt < maxRetries && (msg.includes("503") || msg.includes("429") || msg.includes("overloaded") || msg.includes("demand"))) {
          const delay = Math.pow(2, attempt) * 2000; 
          addLog(`Nouvel essai dans ${delay/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return performAnalysis();
        }

        if (msg.includes("API key") || msg.includes("Requested entity was not found") || msg.includes("401") || msg.includes("403")) {
          setError(lang === 'fr' 
            ? "Erreur de clé API sur le serveur. Veuillez vérifier vos 'Secrets' (⚙️) et REPUBLIER." 
            : "Server API Key error. Please check your 'Secrets' (⚙️) and RE-PUBLISH.");
          setHasApiKey(false);
        } else if (msg.includes("429") || msg.includes("Quota") || msg.includes("limit")) {
          setQuotaExceeded(true);
          setError("Limite de requêtes atteinte (Quota). Réessayez dans une minute.");
        } else {
          setError(err.message || t.errorGeneric);
        }
      } finally {
        clearInterval(stepInterval);
        setIsAnalyzing(false);
      }
    };

    performAnalysis();
  };

  const handleAskQuestion = async () => {
    if (!userQuestion.trim() || !analysisResult || isAsking) return;
    
    const question = userQuestion.trim();
    setUserQuestion('');
    setChatMessages(prev => [...prev, { role: 'user', text: question }]);
    setIsAsking(true);

    try {
      const modelName = isSubscribed || isAdmin ? "gemini-1.5-pro" : "gemini-1.5-flash";
      const systemInstruction = `Tu es un expert en boxe de l'école soviétique. Tu as accès à l'intégralité de l'historique de l'utilisateur. Analyse actuelle : "${analysisResult}". Réponds de manière technique, précise et encourageante. Ton but est de faire de cet utilisateur un maître du style soviétique (Pendulum, distance, relâchement).`;

      const resChat = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', text: question }],
          systemInstruction,
          model: modelName
        })
      });

      if (!resChat.ok) throw new Error("Erreur de chat sur le serveur.");
      const data = await resChat.json();

      setChatMessages(prev => [...prev, { role: 'model', text: data.text || '' }]);
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [...prev, { role: 'model', text: t.errorGeneric }]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleLangChange = (newLang: Language) => {
    const currentId = selectedChapter.id;
    setLang(newLang);
    const newChapter = CHAPTERS[newLang].find(c => c.id === currentId);
    if (newChapter) setSelectedChapter(newChapter);
  };

  const handleSubscribe = async (planType: 'monthly' | 'yearly' = 'monthly') => {
    if (!user) {
      handleLogin();
      return;
    }
    setIsCheckingSubscription(true);
    setError(null);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, userId: user.uid, planType }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Erreur lors de la création de la session Stripe");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsCheckingSubscription(false);
    }
  };

  // --- Render Helpers ---

  const renderSidebar = () => (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-soviet-dark/80 backdrop-blur-sm z-[65] md:hidden"
          />
        )}
      </AnimatePresence>

      <motion.aside 
        initial={false}
        animate={{ 
          x: isSidebarOpen ? 0 : (window.innerWidth < 768 ? -320 : 0),
          width: isSidebarOpen ? 320 : (window.innerWidth < 768 ? 320 : 0),
          opacity: isSidebarOpen ? 1 : (window.innerWidth < 768 ? 1 : 0)
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className={cn(
          "bg-soviet-dark border-r-2 border-soviet-light flex flex-col h-full overflow-hidden z-[70]",
          "fixed inset-y-0 left-0 md:relative"
        )}
      >
        <div className="p-6 border-b-2 border-soviet-light flex items-center justify-between bg-soviet-dark">
          <h1 className="text-2xl font-display font-black text-soviet-red leading-none uppercase italic">
            {t.title.split(' ').slice(0, 2).join(' ')}<br/>{t.title.split(' ').slice(2).join(' ')}
          </h1>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:text-soviet-red transition-colors">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto custom-scrollbar">
        <button 
          onClick={() => setCurrentView('dashboard')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 font-display font-bold uppercase tracking-tight transition-all",
            currentView === 'dashboard' ? "bg-soviet-red text-white" : "hover:bg-soviet-gray"
          )}
        >
          <Activity size={20} />
          {t.dashboard}
        </button>

        <div className="pt-4 pb-2 px-4 text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">{t.theory}</div>
        {CHAPTERS[lang].map((chapter) => {
          const Icon = IconMap[chapter.icon];
          return (
            <button 
              key={chapter.id}
              onClick={() => { setSelectedChapter(chapter); setCurrentView('chapters'); }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 font-display font-bold uppercase tracking-tight transition-all text-sm",
                currentView === 'chapters' && selectedChapter.id === chapter.id ? "bg-soviet-light text-soviet-dark" : "hover:bg-soviet-gray"
              )}
            >
              <Icon size={18} />
              {chapter.title}
            </button>
          );
        })}

        <div className="pt-4 pb-2 px-4 text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">{t.tools}</div>
        <button 
          onClick={() => setCurrentView('analysis')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 font-display font-bold uppercase tracking-tight transition-all",
            currentView === 'analysis' ? "bg-soviet-red text-white" : "hover:bg-soviet-gray"
          )}
        >
          <Zap size={20} />
          {t.analysisLab}
        </button>

        <button 
          onClick={() => setCurrentView('history')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 font-display font-bold uppercase tracking-tight transition-all",
            currentView === 'history' ? "bg-soviet-red text-white" : "hover:bg-soviet-gray"
          )}
        >
          <History size={20} />
          {t.historyTitle}
        </button>

        <button 
          onClick={() => setCurrentView('bivol')}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 font-display font-bold uppercase tracking-tight transition-all",
            currentView === 'bivol' ? "bg-soviet-red text-white" : "hover:bg-soviet-gray"
          )}
        >
          <Award size={20} />
          {t.bivol}
        </button>

        <div className="pt-4 pb-2 px-4 text-[10px] uppercase tracking-[0.2em] font-bold opacity-50">Compte</div>
        {user ? (
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-soviet-light" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-soviet-gray flex items-center justify-center border border-soviet-light">
                  <UserIcon size={16} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold truncate">{user.displayName}</div>
                <div className="text-[10px] opacity-50 truncate">{isAdmin ? 'ADMINISTRATEUR' : 'MEMBRE'}</div>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-display font-bold uppercase tracking-tight hover:bg-soviet-red hover:text-white transition-all brutalist-border">
              <LogOut size={14} /> Déconnexion
            </button>
          </div>
        ) : (
          <div className="px-4 py-3">
            <button onClick={handleLogin} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-display font-bold uppercase tracking-tight bg-soviet-red text-white hover:bg-white hover:text-soviet-red transition-all brutalist-border">
              <LogIn size={14} /> Connexion Google
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t-2 border-soviet-light space-y-3">
        {!isSubscribed && !isAdmin && (
          <div className="space-y-3">
            <div className="p-3 brutalist-border bg-soviet-gray/20 space-y-2">
              <div className="text-[10px] uppercase font-bold opacity-50">{t.trialRemaining}</div>
              <div className={cn("text-xl font-display font-black italic", isTrialExpired ? "text-soviet-red" : "text-white")}>
                {timeLeft.hours}{t.hours} {timeLeft.minutes}{t.minutes}
              </div>
            </div>
            <div className="p-3 brutalist-border bg-soviet-red/10 border-soviet-red/30 space-y-1">
              <div className="text-[10px] uppercase font-bold opacity-50">{t.analysesRemaining}</div>
              <div className="text-xl font-display font-black italic text-soviet-red">
                {FREE_LIMIT - freeAnalysesUsed} / {FREE_LIMIT}
              </div>
            </div>
          </div>
        )}
        <button onClick={handleRefresh} className="w-full flex items-center justify-between group">
          <div className="text-[10px] font-mono opacity-50 uppercase group-hover:opacity-100 transition-opacity">v2.0.0 // {t.systemOperational}</div>
          <RefreshCw size={12} className="opacity-30 group-hover:opacity-100 group-hover:rotate-180 transition-all duration-500" />
        </button>
      </div>
      </motion.aside>
    </>
  );

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-soviet-dark text-soviet-light overflow-hidden selection:bg-soviet-red selection:text-white">
        <div className="scanline-container" />
        
        {/* Mobile Header */}
        <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-soviet-dark/90 backdrop-blur-md border-b-2 border-soviet-light z-[60] flex items-center justify-between px-4">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsSidebarOpen(true);
            }} 
            className="p-2 soviet-card !p-2 !bg-soviet-red !text-white"
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-display font-black text-soviet-red italic uppercase tracking-tighter">SOVIET BOXING</h1>
          <div className="flex gap-2">
            {(['fr', 'en', 'es'] as Language[]).map(l => (
              <button key={l} onClick={() => handleLangChange(l)} className={cn("text-[10px] font-black uppercase p-1", lang === l ? "text-soviet-red" : "opacity-50")}>{l}</button>
            ))}
          </div>
        </header>

        {renderSidebar()}

        <main className="flex-1 flex flex-col relative overflow-hidden pt-16 md:pt-0">
          {/* Desktop Header */}
          <header className="hidden md:flex h-16 border-b-2 border-soviet-light items-center justify-between px-6 bg-soviet-dark/80 backdrop-blur-md z-40">
            <div className="flex items-center gap-6">
              <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-soviet-gray brutalist-border">
                {isSidebarOpen ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
              <div className="flex items-center bg-soviet-gray/30 brutalist-border p-1">
                {(['fr', 'en', 'es'] as Language[]).map(l => (
                  <button key={l} onClick={() => handleLangChange(l)} className={cn("px-3 py-1 text-[10px] font-display font-black uppercase transition-all", lang === l ? "bg-soviet-red text-white" : "hover:text-soviet-red")}>{l}</button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                {t.aiCoreActive}
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-12 custom-scrollbar">
            <AnimatePresence>
              {isCompressing && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-soviet-dark/95 backdrop-blur-xl"
                >
                  <div className="soviet-card max-w-lg w-full p-12 text-center space-y-8 border-soviet-red relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-soviet-red/20">
                      <motion.div 
                        className="h-full bg-soviet-red"
                        animate={{ width: `${compressionProgress}%` }}
                      />
                    </div>
                    
                    <div className="relative">
                      <RefreshCw size={64} className="text-soviet-red mx-auto animate-spin mb-4" />
                      <Activity size={32} className="absolute inset-0 m-auto text-white animate-pulse" />
                    </div>

                    <div className="space-y-4">
                      <h2 className="text-4xl font-display font-black italic uppercase tracking-tighter text-soviet-red">
                        Optimisation Lab
                      </h2>
                      <p className="font-mono text-sm opacity-70">
                        Traitement de la vidéo : <span className="text-white bg-soviet-red/20 px-2 uppercase font-bold">{isCompressing}</span>
                      </p>
                      <div className="font-mono text-2xl font-black text-soviet-red tracking-widest">
                        {compressionProgress}%
                      </div>
                      <p className="text-xs opacity-50 uppercase tracking-widest max-w-xs mx-auto">
                        Réduction de la charge utile moléculaire pour analyse IA profonde...
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-2 opacity-30">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-1 bg-soviet-red animate-pulse" style={{ animationDelay: `${i * 200}ms` }} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-5xl mx-auto mb-8 p-4 bg-soviet-red/10 border-4 border-soviet-red brutalist-border flex items-start gap-4 relative"
                >
                  <AlertCircle className="text-soviet-red shrink-0" size={24} />
                  <div className="flex-1 space-y-2">
                    <div className="text-sm font-display font-black uppercase italic text-soviet-red">Alerte Système</div>
                    <p className="text-xs font-mono font-bold leading-relaxed">{error}</p>
                    
                    {(error.includes('Clé') || error.includes('Key') || error.includes('IA')) && (
                      <div className="pt-2">
                        <button 
                          onClick={handleSelectKey}
                          className="text-[10px] bg-soviet-red text-white px-3 py-1 font-display font-black uppercase hover:bg-white hover:text-soviet-red transition-all inline-flex items-center gap-2 animate-bounce"
                        >
                          🛠️ RÉPARER LA CONNEXION IA
                        </button>
                      </div>
                    )}
                    {error.includes('Domaines autorisés') && (
                      <div className="pt-2">
                        <a 
                          href="https://console.firebase.google.com/project/_/authentication/providers" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] bg-soviet-red text-white px-3 py-1 font-display font-black uppercase hover:bg-white hover:text-soviet-red transition-all inline-flex items-center gap-2"
                        >
                          <ExternalLink size={12} /> Configurer Authentication dans Firebase
                        </a>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setError(null)} className="p-1 hover:text-soviet-red transition-colors">
                    <X size={20} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {!isAuthReady ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full space-y-4"
                >
                  <Loader2 className="animate-spin text-soviet-red" size={48} />
                  <div className="font-mono text-xs uppercase tracking-[0.3em] animate-pulse">Initialisation du Système...</div>
                </motion.div>
              ) : currentView === 'dashboard' && (
                <motion.div key="dashboard" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto space-y-12">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div className="space-y-8">
                      <h2 className="text-6xl md:text-8xl font-display font-black uppercase leading-[0.85] tracking-tighter">
                        {t.victoryScience.split(' ').slice(0, -1).join(' ')} <br/>
                        <span className="text-soviet-red italic">{t.victoryScience.split(' ').pop()}</span>
                      </h2>
                      <p className="text-lg opacity-80 leading-relaxed max-w-lg">{t.welcome}</p>
                      <div className="flex flex-wrap gap-4">
                        <button onClick={() => setCurrentView('chapters')} className="soviet-button soviet-button-primary">{t.startStudy}</button>
                        <button onClick={() => setCurrentView('analysis')} className="soviet-button soviet-button-secondary">{t.analysisLab}</button>
                      </div>
                      
                      {!isSubscribed && !isAdmin && (
                        <div className="pt-6 space-y-3">
                          <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-widest opacity-60">
                            <span>{t.analysesRemaining}</span>
                            <span className="text-soviet-red font-black">
                              {FREE_LIMIT - freeAnalysesUsed} / {FREE_LIMIT}
                            </span>
                          </div>
                          <div className="h-2 w-full bg-soviet-gray brutalist-border overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${(freeAnalysesUsed / FREE_LIMIT) * 100}%` }}
                              className="h-full bg-soviet-red" 
                            />
                          </div>
                          <p className="text-[10px] italic opacity-40 uppercase tracking-tight">
                            → {t.trialRemaining} {timeLeft.hours}{t.hours} {timeLeft.minutes}{t.minutes}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { id: 'relachement', icon: Wind, label: t.relachement, pillar: t.pillar01 },
                        { id: 'jeu-de-jambes', icon: Footprints, label: t.mobilite, pillar: t.pillar02 },
                        { id: 'distance', icon: Target, label: t.distance, pillar: t.pillar03 },
                        { id: 'tactique', icon: Brain, label: t.tactique, pillar: t.pillar04 }
                      ].map(item => (
                        <div key={item.id} onClick={() => { setSelectedChapter(CHAPTERS[lang].find(c => c.id === item.id) || selectedChapter); setCurrentView('chapters'); }} className="soviet-card group cursor-pointer">
                          <item.icon className="text-soviet-red group-hover:scale-110 transition-transform mb-4" size={32} />
                          <div className="text-[10px] font-mono uppercase opacity-50 mb-1">{item.pillar}</div>
                          <div className="font-display font-bold uppercase text-sm">{item.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="brutalist-border p-8 bg-soviet-gray/30 relative overflow-hidden">
                    <Shield size={120} className="absolute -right-4 -bottom-4 opacity-5" />
                    <h3 className="text-2xl font-display font-bold uppercase mb-4 flex items-center gap-3"><Info className="text-soviet-red" /> {t.sovietNote}</h3>
                    <p className="italic text-xl opacity-90 max-w-3xl">"{t.sovietQuote}"</p>
                  </div>
                </motion.div>
              )}

              {currentView === 'chapters' && (
                <motion.div key="chapters" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="max-w-3xl mx-auto">
                  <div className="markdown-body">
                    <ReactMarkdown>{selectedChapter.content}</ReactMarkdown>
                  </div>
                  <div className="mt-16 pt-8 border-t-2 border-soviet-gray flex justify-between">
                    <button 
                      onClick={() => { const idx = CHAPTERS[lang].findIndex(c => c.id === selectedChapter.id); if (idx > 0) setSelectedChapter(CHAPTERS[lang][idx - 1]); }}
                      disabled={CHAPTERS[lang].findIndex(c => c.id === selectedChapter.id) === 0}
                      className="flex items-center gap-2 font-display font-bold uppercase hover:text-soviet-red disabled:opacity-30"
                    >
                      <ChevronLeft size={20} /> {t.previous}
                    </button>
                    <button 
                      onClick={() => { 
                        const idx = CHAPTERS[lang].findIndex(c => c.id === selectedChapter.id);
                        if (idx < CHAPTERS[lang].length - 1) setSelectedChapter(CHAPTERS[lang][idx + 1]);
                        else setCurrentView('analysis');
                      }}
                      className="flex items-center gap-2 font-display font-bold uppercase hover:text-soviet-red"
                    >
                      {CHAPTERS[lang].findIndex(c => c.id === selectedChapter.id) === CHAPTERS[lang].length - 1 ? t.toAnalysis : t.next}
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </motion.div>
              )}

              {currentView === 'analysis' && (
                <motion.div key="analysis" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="max-w-6xl mx-auto space-y-12">
                  
                  {/* Diagnostic Status Bar */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="p-3 brutalist-border bg-soviet-gray/20 flex flex-col gap-1">
                      <span className="text-[8px] uppercase font-bold opacity-50">Utilisateur</span>
                      <span className="text-xs font-bold truncate">{user ? user.displayName : 'Anonyme'}</span>
                    </div>
                    <div className="p-3 brutalist-border bg-soviet-gray/20 flex flex-col gap-1">
                      <span className="text-[8px] uppercase font-bold opacity-50">Statut</span>
                      <span className={cn("text-xs font-bold", isAdmin ? "text-soviet-red" : "text-white")}>
                        {isAdmin ? 'ADMINISTRATEUR' : (isSubscribed ? 'ABONNÉ' : 'ESSAI')}
                      </span>
                    </div>
                    <div className="p-3 brutalist-border bg-soviet-gray/20 flex flex-col gap-1">
                      <span className="text-[8px] uppercase font-bold opacity-50">IA Core</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleSelectKey}
                          className={cn(
                            "text-[10px] font-black underline uppercase", 
                            hasApiKey ? "text-green-500" : "text-soviet-red animate-pulse"
                          )}
                        >
                          {hasApiKey ? "CHANGER" : "RECONNECTER"}
                        </button>
                        <button 
                          onClick={testApiKey}
                          className="text-[10px] font-black underline uppercase text-soviet-blue"
                        >
                          TESTER
                        </button>
                      </div>
                    </div>
                    <div className="p-3 brutalist-border bg-soviet-gray/20 flex flex-col gap-1">
                      <span className="text-[8px] uppercase font-bold opacity-50">
                        {isSubscribed || isAdmin ? 'Quota' : t.analysesRemaining}
                      </span>
                      <span className={cn("text-xs font-bold", (quotaExceeded || (!isSubscribed && !isAdmin && !hasFreeAnalyses)) ? "text-soviet-red" : "text-green-500")}>
                        {isSubscribed || isAdmin 
                          ? (quotaExceeded ? 'LIMITE ATTEINTE' : 'OPTIMAL')
                          : `${FREE_LIMIT - freeAnalysesUsed} / ${FREE_LIMIT}`}
                      </span>
                    </div>
                  </div>

                  {!hasAccess ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-8 text-center">
                      <Lock size={80} className="text-soviet-red animate-pulse" />
                      <div className="space-y-4">
                        <h2 className="text-5xl font-display font-black uppercase italic">
                          {!hasFreeAnalyses && !isSubscribed && !isAdmin ? t.trialLimitReached : t.trialExpired}
                        </h2>
                        <p className="max-w-md mx-auto opacity-70">
                          {!hasFreeAnalyses && !isSubscribed && !isAdmin ? t.trialLimitReachedDesc : t.trialExpiredDesc}
                        </p>
                      </div>
                      <button onClick={() => setCurrentView('subscription')} className="soviet-button soviet-button-primary px-12 py-4 text-xl">{t.subscribe}</button>
                    </div>
                  ) : (
                    <>
                      <div className="text-center space-y-4">
                        <h2 className="text-6xl font-display font-black uppercase italic tracking-tighter">{t.labTitle}</h2>
                        <p className="opacity-60 font-mono text-sm uppercase tracking-widest">{t.labSubtitle}</p>
                      </div>

                      <div className="max-w-xl mx-auto soviet-card bg-soviet-gray/50 border-soviet-red/30">
                        <div className="flex items-center gap-3 mb-4">
                          <Activity size={18} className="text-soviet-red" />
                          <h3 className="font-display font-bold uppercase text-xs">Diagnostic Système</h3>
                        </div>
                        <div className="space-y-1">
                          {debugLog.length === 0 ? (
                            <div className="text-[10px] font-mono opacity-30 italic">En attente d'activité...</div>
                          ) : (
                            debugLog.map((log, i) => (
                              <div key={i} className={cn(
                                "text-[10px] font-mono flex gap-2",
                                log.startsWith('ERREUR') ? "text-soviet-red" : "opacity-70"
                              )}>
                                <span className="opacity-30">[{new Date().toLocaleTimeString()}]</span>
                                <span>{log}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="max-w-xl mx-auto soviet-card bg-soviet-gray/50 border-soviet-red/30">
                        <label className="block text-[10px] font-mono uppercase mb-2 opacity-70">{t.whoToAnalyze}</label>
                        <input type="text" value={targetBoxer} onChange={(e) => setTargetBoxer(e.target.value)} placeholder={t.placeholderIA} className="w-full bg-soviet-dark brutalist-border px-4 py-3 font-sans focus:border-soviet-red outline-none transition-colors" />
                      </div>

                      <div className="soviet-card p-6 border-soviet-light/30 bg-soviet-gray/10 mb-8 font-mono text-[10px] space-y-2">
                <div className="flex justify-between border-b border-soviet-light/10 pb-1">
                  <span className="opacity-50 uppercase tracking-widest">Connecté à</span>
                  <span className="text-soviet-red truncate ml-4">{window.location.hostname}</span>
                </div>
                <div className="flex justify-between border-b border-soviet-light/10 pb-1">
                  <span className="opacity-50 uppercase tracking-widest">Status Firebase</span>
                  <span className={cn(isAuthReady ? "text-green-500" : "text-yellow-500")}>
                    {isAuthReady ? "OPÉRATIONNEL" : "INITIALISATION..."}
                  </span>
                </div>
                {!user && (
                  <p className="text-soviet-red italic animate-pulse mt-4 bg-soviet-red/5 p-2 border border-soviet-red/20">
                    ATTENTION : Si la connexion échoue, assurez-vous que "{window.location.hostname}" est ajouté aux Domaines Autorisés dans Firebase.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {[
                          { type: 'user', label: t.yourMovement, icon: Activity, video: userVideo, ref: userVideoRef, reset: () => setUserVideo(null) },
                          { type: 'ref', label: t.refMaster, icon: Shield, video: refVideo, ref: refVideoRef, reset: () => setRefVideo(null) }
                        ].map(box => (
                          <div key={box.type} className="space-y-4">
                            <div className="flex justify-between items-center">
                              <h3 className="font-display font-bold uppercase flex items-center gap-2 text-sm"><box.icon size={16} className="text-soviet-red" /> {box.label}</h3>
                              {box.video && <button onClick={box.reset} className="text-[10px] uppercase font-bold hover:text-soviet-red">{t.reset}</button>}
                            </div>
                            <div className="aspect-video brutalist-border bg-soviet-gray flex flex-col items-center justify-center relative overflow-hidden group">
                              {box.video ? (
                                <video 
                                  src={box.video} 
                                  controls 
                                  className="w-full h-full object-cover"
                                  onError={() => setError(lang === 'fr' ? "Format vidéo non supporté par ce navigateur. Essayez un format .mp4 standard." : "Video format not supported by this browser. Try a standard .mp4.")}
                                />
                              ) : (
                                <button onClick={() => box.ref.current?.click()} className="flex flex-col items-center gap-4 hover:text-soviet-red transition-colors">
                                  <Upload size={48} />
                                  <span className="font-display font-bold uppercase tracking-widest text-xs">{t.importVideo}</span>
                                </button>
                              )}
                              <input type="file" ref={box.ref} className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, box.type as any)} />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex flex-col items-center gap-6">
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[10px] font-mono text-soviet-red/60 text-center max-w-md uppercase tracking-tighter">
                            {t.videoTip}
                          </div>
                          <button 
                            onClick={() => setShowOptimizationGuide(true)}
                            className="text-[10px] font-mono text-soviet-blue hover:underline uppercase"
                          >
                            {lang === 'fr' ? "→ Guide d'optimisation vidéo" : lang === 'es' ? "→ Guía de optimización de video" : "→ Video optimization guide"}
                          </button>
                        </div>
                        <button onClick={runAnalysis} disabled={isAnalyzing || !userVideo || !refVideo} className={cn("soviet-button soviet-button-primary text-xl px-16 py-5 flex items-center gap-4", (isAnalyzing || !userVideo || !refVideo) && "opacity-50 cursor-not-allowed")}>
                          {isAnalyzing ? (
                            <>
                              <Loader2 className="animate-spin" /> 
                              <span className="flex flex-col items-start leading-none">
                                <span className="text-[10px] opacity-70 uppercase font-mono mb-1">
                                  {analysisStep === 0 ? (lang === 'fr' ? "Initialisation..." : "Initializing...") :
                                   analysisStep === 1 ? (lang === 'fr' ? "Analyse biomécanique..." : "Biomechanical analysis...") :
                                   analysisStep === 2 ? (lang === 'fr' ? "Comparaison technique..." : "Technical comparison...") :
                                   (lang === 'fr' ? "Rédaction du rapport..." : "Writing report...")}
                                </span>
                                {t.analyzing}
                              </span>
                            </>
                          ) : <><Zap /> {t.runAnalysis}</>}
                        </button>
                      </div>

                      <AnimatePresence>
                        {analysisResult && (
                          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                            <div className="brutalist-border p-10 bg-soviet-light text-soviet-dark relative">
                              <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 size={100} /></div>
                              <div className="flex items-center gap-4 mb-8 border-b-4 border-soviet-dark pb-6">
                                <Activity className="text-soviet-red" size={40} />
                                <h3 className="text-4xl font-display font-black uppercase italic">{t.reportTitle}</h3>
                              </div>
                              <div className="markdown-body prose-p:text-soviet-dark prose-headings:text-soviet-dark prose-li:text-soviet-dark text-soviet-dark">
                                <ReactMarkdown>{analysisResult}</ReactMarkdown>
                              </div>
                            </div>

                            <div className="bg-soviet-gray brutalist-border p-8 space-y-8">
                              <div className="flex items-center gap-3 border-b-2 border-soviet-light/10 pb-4">
                                <Brain size={24} className="text-soviet-red" />
                                <h4 className="text-xl font-display font-bold uppercase tracking-wider">{t.chatHistory}</h4>
                              </div>
                              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                                {chatMessages.map((msg, idx) => (
                                  <div key={idx} className={cn(
                                    "p-6 brutalist-border relative", 
                                    msg.role === 'user' 
                                      ? "bg-soviet-dark/80 ml-12 border-soviet-red" 
                                      : "bg-soviet-gray mr-12 border-white shadow-[4px_4px_0px_0px_rgba(255,0,0,0.2)]"
                                  )}>
                                    <div className="font-mono text-[10px] uppercase mb-2 opacity-50 text-soviet-red font-bold">
                                      {msg.role === 'user' ? 'Boxer' : 'Coach'}
                                    </div>
                                    <div className="markdown-body prose-invert text-sm">
                                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                                    </div>
                                  </div>
                                ))}
                                {isAsking && <div className="flex items-center gap-3 text-soviet-red animate-pulse font-mono text-sm"><Loader2 size={18} className="animate-spin" /> {t.aiThinking}</div>}
                              </div>
                              <div className="flex gap-4">
                                <input type="text" value={userQuestion} onChange={(e) => setUserQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()} placeholder={t.askPlaceholder} className="flex-1 bg-soviet-dark brutalist-border px-6 py-4 font-sans focus:border-soviet-red outline-none transition-colors" />
                                <button onClick={handleAskQuestion} disabled={isAsking || !userQuestion.trim()} className="soviet-button soviet-button-primary"><Send size={24} /></button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="mt-20 space-y-8">
                        <div className="flex items-center gap-4 border-b-4 border-soviet-red pb-4">
                          <History className="text-soviet-red" size={32} />
                          <h3 className="text-4xl font-display font-black uppercase italic tracking-tighter">{t.historyTitle}</h3>
                        </div>
                        
                        {history.length === 0 ? (
                          <div className="p-12 brutalist-border bg-soviet-gray/30 text-center opacity-50 italic font-mono uppercase text-sm">
                            {t.noHistory}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[...history].reverse().map((entry) => (
                              <div key={entry.id} className="soviet-card bg-soviet-gray/40 hover:bg-soviet-gray/60 transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                  <div className="space-y-1">
                                    <div className="text-[10px] font-mono text-soviet-red font-bold uppercase">{entry.date}</div>
                                    <div className="text-lg font-display font-black uppercase italic tracking-tight">{entry.targetBoxer}</div>
                                  </div>
                                  <button 
                                    onClick={() => setAnalysisResult(entry.result)}
                                    className="text-[10px] font-mono uppercase bg-soviet-red px-3 py-1 hover:bg-white hover:text-soviet-red transition-colors"
                                  >
                                    {lang === 'fr' ? "Voir Rapport" : lang === 'es' ? "Ver Informe" : "View Report"}
                                  </button>
                                </div>
                                <div className="text-xs opacity-80 line-clamp-3 font-sans leading-relaxed italic">
                                  {entry.result.substring(0, 200)}...
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {currentView === 'history' && (
                <motion.div key="history" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto space-y-8">
                  <div className="flex items-center gap-4 border-b-4 border-soviet-red pb-4">
                    <History className="text-soviet-red" size={32} />
                    <h3 className="text-4xl font-display font-black uppercase italic tracking-tighter">{t.historyTitle}</h3>
                  </div>
                  
                  {history.length === 0 ? (
                    <div className="p-12 brutalist-border bg-soviet-gray/30 text-center opacity-50 italic font-mono uppercase text-sm">
                      {t.noHistory}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {[...history].reverse().map((entry) => (
                        <div key={entry.id} className="soviet-card bg-soviet-gray/40 hover:bg-soviet-gray/60 transition-all group">
                          <div className="flex justify-between items-start mb-4">
                            <div className="space-y-1">
                              <div className="text-[10px] font-mono text-soviet-red font-bold uppercase">{entry.date}</div>
                              <div className="text-lg font-display font-black uppercase italic tracking-tight">{entry.targetBoxer}</div>
                            </div>
                            <button 
                              onClick={() => {
                                setAnalysisResult(entry.result);
                                setCurrentView('analysis');
                              }}
                              className="text-[10px] font-mono uppercase bg-soviet-red text-white px-3 py-1 hover:bg-white hover:text-soviet-red transition-colors"
                            >
                              {lang === 'fr' ? "Voir Rapport" : lang === 'es' ? "Ver Informe" : "View Report"}
                            </button>
                          </div>
                          <div className="text-xs opacity-80 line-clamp-3 font-sans leading-relaxed italic">
                            {entry.result.substring(0, 200)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {currentView === 'bivol' && (
                <motion.div key="bivol" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-5xl mx-auto space-y-12">
                  <div className="relative h-[400px] brutalist-border overflow-hidden group">
                    <img src="https://picsum.photos/seed/bivol/1200/600" alt="Dmitry Bivol" className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-gradient-to-t from-soviet-dark via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 p-10 space-y-4">
                      <div className="bg-soviet-red text-white px-4 py-1 inline-block font-display font-black uppercase text-sm italic">Master Class</div>
                      <h2 className="text-7xl font-display font-black uppercase italic leading-none tracking-tighter">DMITRY <span className="text-soviet-red">BIVOL</span></h2>
                      <p className="text-xl italic opacity-90">"{t.bivolQuote}"</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {[
                      { title: t.bivolDiscipline, desc: t.bivolDisciplineDesc, icon: Shield },
                      { title: t.bivolLeadHand, desc: t.bivolLeadHandDesc, icon: Target },
                      { title: t.bivolFootwork, desc: t.bivolFootworkDesc, icon: Footprints }
                    ].map((feature, i) => (
                      <div key={i} className="soviet-card space-y-4">
                        <feature.icon className="text-soviet-red" size={32} />
                        <h4 className="text-lg font-display font-bold uppercase">{feature.title}</h4>
                        <p className="text-sm opacity-70 leading-relaxed">{feature.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="brutalist-border p-10 bg-soviet-red text-white flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="space-y-4 text-center md:text-left">
                      <h3 className="text-4xl font-display font-black uppercase italic">{t.readyToDecrypt}</h3>
                      <p className="max-w-xl opacity-90">{t.telegramDesc}</p>
                    </div>
                    <a href="https://t.me/boxing_science" target="_blank" rel="noopener noreferrer" className="soviet-button bg-white text-soviet-red hover:bg-soviet-dark hover:text-white flex items-center gap-3 whitespace-nowrap">
                      <ExternalLink size={20} /> {t.accessTelegram}
                    </a>
                  </div>
                </motion.div>
              )}

              {currentView === 'subscription' && (
                <motion.div key="subscription" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-4xl mx-auto space-y-12">
                  <div className="text-center space-y-4">
                    <h2 className="text-7xl font-display font-black uppercase italic tracking-tighter">CHOISISSEZ VOTRE <span className="text-soviet-red">DESTIN</span></h2>
                    <p className="opacity-60 font-mono text-sm uppercase tracking-widest">L'excellence technique n'a pas de prix, mais elle a un coût.</p>
                  </div>

                  <div className="bg-soviet-gray/30 brutalist-border p-8 border-soviet-blue/30 relative overflow-hidden">
                    <Shield size={60} className="absolute -right-4 -bottom-4 opacity-5 text-soviet-blue" />
                    <h3 className="text-xl font-display font-black uppercase text-soviet-blue mb-4 flex items-center gap-2">
                      <Lock size={18} /> {lang === 'fr' ? "Engagement & Sécurité" : lang === 'es' ? "Compromiso y Seguridad" : "Commitment & Security"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-[10px] font-mono leading-relaxed uppercase opacity-80">
                      <div className="space-y-2">
                        <div className="font-black text-soviet-red">01. LIBERTÉ TOTALE</div>
                        <p>{lang === 'fr' ? "Sans engagement. Annulation en un clic depuis votre espace client." : "No commitment. One-click cancellation from your client area."}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="font-black text-soviet-red">02. PAIEMENT SÉCURISÉ</div>
                        <p>{lang === 'fr' ? "Transactions cryptées via Stripe (Certifié PCI). Aucune donnée bancaire stockée ici." : "Encrypted transactions via Stripe (PCI Certified). No banking data stored here."}</p>
                      </div>
                      <div className="space-y-2">
                        <div className="font-black text-soviet-red">03. PROTECTION DES DONNÉES</div>
                        <p>{lang === 'fr' ? "Vos vidéos vous appartiennent. Elles sont traitées uniquement pour votre analyse privée." : "Your videos belong to you. They are processed only for your private analysis."}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {[
                      { title: t.monthlySub, price: t.priceMonthly, features: [t.unlimitedAccess, t.prioritySupport], best: false, type: 'monthly' },
                      { title: t.yearlySub, price: t.priceYearly, features: [t.unlimitedAccess, t.prioritySupport, t.newChapters], best: true, type: 'yearly' }
                    ].map((plan, i) => (
                      <div key={i} className={cn("soviet-card relative flex flex-col justify-between p-10", plan.best && "border-soviet-red border-4 shadow-[12px_12px_0px_0px_rgba(255,0,0,0.2)]")}>
                        {plan.best && <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-soviet-red text-white px-6 py-1 font-display font-black uppercase text-xs italic">{t.bestValue}</div>}
                        <div className="space-y-8">
                          <div className="space-y-2">
                            <h3 className="text-3xl font-display font-bold uppercase">{plan.title}</h3>
                            <div className="text-5xl font-display font-black text-soviet-red italic">{plan.price}</div>
                          </div>
                          <ul className="space-y-4">
                            {plan.features.map((f, j) => (
                              <li key={j} className="flex items-center gap-3 text-sm font-bold uppercase tracking-tight">
                                <CheckCircle2 className="text-soviet-red" size={18} /> {f}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <button 
                          onClick={() => handleSubscribe(plan.type as any)} 
                          disabled={isCheckingSubscription}
                          className="soviet-button soviet-button-primary w-full mt-12"
                        >
                          {isCheckingSubscription ? <Loader2 className="animate-spin mx-auto" /> : t.subscribe}
                        </button>
                      </div>
                    ))}
                  </div>

                  {isSubscribed && (
                    <div className="pt-12 text-center">
                      <p className="text-xs font-mono opacity-50 mb-4 uppercase">Vous êtes déjà membre de l'élite Boxing Science.</p>
                      <button 
                        onClick={() => window.open('https://billing.stripe.com/p/login/test_your_link_here', '_blank')}
                        className="text-[10px] font-display font-black uppercase italic text-soviet-red hover:text-white transition-colors underline"
                      >
                        {lang === 'fr' ? "→ Gérer mon abonnement / Factures" : "→ Manage subscription / Invoices"}
                      </button>
                      <p className="mt-4 text-[8px] opacity-30 italic">Note : Utilisez le lien envoyé par Stripe lors de votre premier achat pour accéder à votre portail sécurisé.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Video Optimization Guide Modal */}
      <AnimatePresence>
        {showOptimizationGuide && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowOptimizationGuide(false)}
              className="absolute inset-0 bg-soviet-dark/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-soviet-light text-soviet-dark p-8 brutalist-border shadow-[12px_12px_0px_0px_rgba(255,0,0,0.3)]"
            >
              <button 
                onClick={() => setShowOptimizationGuide(false)}
                className="absolute top-4 right-4 p-2 hover:text-soviet-red transition-colors"
              >
                <X size={24} />
              </button>

              <div className="flex items-center gap-4 mb-8 border-b-4 border-soviet-dark pb-6">
                <Video className="text-soviet-red" size={32} />
                <h3 className="text-3xl font-display font-black uppercase italic">
                  {lang === 'fr' ? "Guide d'Optimisation" : lang === 'es' ? "Guía de Optimización" : "Optimization Guide"}
                </h3>
              </div>

              <div className="space-y-6 font-sans">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-display font-bold uppercase text-soviet-red">1. {lang === 'fr' ? "Résolution" : lang === 'es' ? "Resolución" : "Resolution"}</h4>
                    <p className="text-sm leading-relaxed">
                      {lang === 'fr' 
                        ? "Filmez en 720p (HD). La 4K est trop lourde pour le web et n'apporte rien de plus à l'IA." 
                        : lang === 'es' 
                        ? "Graba en 720p (HD). El 4K es demasiado pesado para la web y no aporta más a la IA." 
                        : "Shoot in 720p (HD). 4K is too heavy for the web and doesn't add more for the AI."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-display font-bold uppercase text-soviet-red">2. {lang === 'fr' ? "Fluidité" : lang === 'es' ? "Fluidez" : "Smoothness"}</h4>
                    <p className="text-sm leading-relaxed">
                      {lang === 'fr' 
                        ? "Utilisez 30 FPS. C'est le standard idéal pour décomposer un mouvement." 
                        : lang === 'es' 
                        ? "Usa 30 FPS. Es el estándar ideal para descomponer un movimiento." 
                        : "Use 30 FPS. It's the ideal standard for breaking down a movement."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-display font-bold uppercase text-soviet-red">3. {lang === 'fr' ? "Durée" : lang === 'es' ? "Duración" : "Duration"}</h4>
                    <p className="text-sm leading-relaxed">
                      {lang === 'fr' 
                        ? "Visez des séquences de 15 à 60 secondes. C'est parfait pour une analyse complète." 
                        : lang === 'es' 
                        ? "Apunta a secuencias de 15 a 60 segundos. Es perfecto para un análisis completo." 
                        : "Aim for sequences of 15 to 60 seconds. It's perfect for a complete analysis."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-display font-bold uppercase text-soviet-red">4. {lang === 'fr' ? "Cadrage" : lang === 'es' ? "Encuadre" : "Framing"}</h4>
                    <p className="text-sm leading-relaxed">
                      {lang === 'fr' 
                        ? "Assurez-vous que tout le corps est visible (des pieds à la tête)." 
                        : lang === 'es' 
                        ? "Asegúrate de que todo el cuerpo sea visible (de pies a cabeza)." 
                        : "Make sure the whole body is visible (from head to toe)."}
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-soviet-dark text-white font-mono text-[10px] uppercase border-l-4 border-soviet-red">
                  {lang === 'fr' 
                    ? "Note : Une vidéo de 60s en 720p pèse environ 24Mo. C'est le format optimal pour une analyse complète."
                    : "Note: A 60s video in 720p is about 24MB. This is the optimal format for a complete analysis."}
                </div>

                <button 
                  onClick={() => setShowOptimizationGuide(false)}
                  className="soviet-button soviet-button-primary w-full py-4 text-lg"
                >
                  {lang === 'fr' ? "J'AI COMPRIS" : "UNDERSTOOD"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ErrorBoundary>
  );
}
