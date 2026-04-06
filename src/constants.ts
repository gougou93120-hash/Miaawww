export type Language = 'fr' | 'en' | 'es';

export const CHAPTERS: Record<Language, any[]> = {
  fr: [
    {
      id: 'intro',
      title: 'Principes Fondamentaux',
      icon: 'Shield',
      content: `
# 🥊 Le style soviétique en boxe : principes fondamentaux

Le style soviétique repose sur quatre grands piliers :
- **Le relâchement**
- **Le jeu de jambes**
- **Le travail à distance**
- **La tactique**

C’est un style axé sur la fluidité, la maîtrise technique, la gestion de la distance et l’intelligence de combat. Il vise à maximiser l'efficacité tout en minimisant les risques.
      `
    },
    {
      id: 'relachement',
      title: '1. Le Relâchement',
      icon: 'Wind',
      content: `
# 🔹 1. Le relâchement : fondement du style

Le relâchement est la base de tout. Il concerne d’abord le corps, puis par extension l’esprit. 

Un corps crispé est limité dans ses mouvements, tandis qu’un corps relâché permet des gestes fluides, rapides, précis, de pouvoir contrôler sa respiration et une plus grande adaptabilité.

Un boxeur tendu entrave sa propre mécanique : ses coups deviennent rigides, ses déplacements moins efficaces, et sa respiration moins contrôlée, l’épuisement et donc inévitable.

À l’inverse, un boxeur détendu agit avec naturel, sans forcer, et cela se voit dans chaque action.

> 🧠 **Force élastique** : un transfert d’énergie fluide, du sol jusqu’au poing, sans rupture dans la chaîne musculaire.

### Comment travailler ?
- Imaginez vos bras et jambes comme des fouets.
- Gardez les épaules mobiles et souples.
- Passez d'un état fluide à un état compact uniquement au moment de l'impact.
      `
    },
    {
      id: 'jeu-de-jambes',
      title: '2. Le Jeu de Jambes',
      icon: 'Zap',
      content: `
# 🔹 2. Le jeu de jambes : la mobilité comme arme

Dans le style soviétique, le jeu de jambes est en perpétuel mouvement. On utilise le **"pendulum"** (sautillement continu).

### Objectifs du jeu de jambes :
1. Rester hors de portée.
2. Entrer et sortir rapidement.
3. Créer des angles d'attaque.
4. Désorienter l'adversaire par des feintes.

### Les trois piliers de la jambe soviétique :
- **Rapidité** : pour surprendre et éviter.
- **Puissance** : pour générer de l'impact sans ancrage total.
- **Endurance** : pour maintenir la mobilité tout au long du combat.
      `
    },
    {
      id: 'distance',
      title: '3. Combat à Distance',
      icon: 'Target',
      content: `
# 🔹 3. Le combat à distance : vitesse, précision, contrôle

Le style soviétique privilégie le combat à longue distance. Le corps-à-corps est évité au profit du contrôle spatial.

### Les coups clés :
- **Le Jab** : pour contenir, fixer ou feinter.
- **Le Direct du bras arrière** : souvent utilisé en contre.
- **Le Crochet du bras avant** : en surprise ou en sortie.

> 🧠 Frapper avec relâchement puis contracter au moment de l’impact est bien plus efficace qu’un coup lancé en force du début à la fin.
      `
    },
    {
      id: 'tactique',
      title: '4. La Tactique',
      icon: 'Brain',
      content: `
# 🔹 4. La tactique : maîtriser le temps et l’espace

Le style soviétique est un jeu d’échecs à grande vitesse.

### Stratégie de positionnement :
- À la limite de l'allonge (sécurité).
- À un demi-pas d'engagement (agression éclair).

### Principes tactiques :
- **Provocation** : Utiliser le jab pour forcer une réaction.
- **Contre-attaque** : Toujours anticipée, jamais improvisée.
- **Coups en sortie** : Frapper tout en se déplaçant pour ne pas rester statique.
- **Enchaînements courts** : 3 à 4 coups rapides pour ouvrir la garde.
      `
    }
  ],
  en: [
    {
      id: 'intro',
      title: 'Fundamental Principles',
      icon: 'Shield',
      content: `
# 🥊 Soviet Boxing Style: Fundamental Principles

The Soviet style is based on four main pillars:
- **Relaxation**
- **Footwork**
- **Distance work**
- **Tactics**

It is a style focused on fluidity, technical mastery, distance management, and fighting intelligence. It aims to maximize efficiency while minimizing risks.
      `
    },
    {
      id: 'relachement',
      title: '1. Relaxation',
      icon: 'Wind',
      content: `
# 🔹 1. Relaxation: The Foundation of the Style

Relaxation is the basis of everything. It first concerns the body, then by extension the mind.

A tensed body is limited in its movements, while a relaxed body allows for fluid, fast, precise gestures, better breath control, and greater adaptability.

A tense boxer hinders their own mechanics: their punches become rigid, their movements less effective, and their breathing less controlled, leading to inevitable exhaustion.

Conversely, a relaxed boxer acts naturally, without forcing, and this is visible in every action.

> 🧠 **Elastic Force**: A fluid energy transfer from the ground to the fist, without rupture in the muscular chain.

### How to work on it?
- Imagine your arms and legs as whips.
- Keep shoulders mobile and flexible.
- Switch from a fluid state to a compact state only at the moment of impact.
      `
    },
    {
      id: 'jeu-de-jambes',
      title: '2. Footwork',
      icon: 'Zap',
      content: `
# 🔹 2. Footwork: Mobility as a Weapon

In the Soviet style, footwork is in perpetual motion. We use the **"pendulum"** (continuous bouncing).

### Footwork Objectives:
1. Stay out of range.
2. Enter and exit quickly.
3. Create attack angles.
4. Disorient the opponent with feints.

### The Three Pillars of Soviet Footwork:
- **Speed**: To surprise and avoid.
- **Power**: To generate impact without total anchoring.
- **Endurance**: To maintain mobility throughout the fight.
      `
    },
    {
      id: 'distance',
      title: '3. Distance Fighting',
      icon: 'Target',
      content: `
# 🔹 3. Distance Fighting: Speed, Precision, Control

The Soviet style favors long-distance fighting. Close-quarters combat is avoided in favor of spatial control.

### Key Punches:
- **The Jab**: To contain, fix, or feint.
- **The Rear Hand Straight**: Often used as a counter.
- **The Lead Hook**: As a surprise or on the exit.

> 🧠 Striking with relaxation and then contracting at the moment of impact is much more effective than a punch thrown with force from start to finish.
      `
    },
    {
      id: 'tactique',
      title: '4. Tactics',
      icon: 'Brain',
      content: `
# 🔹 4. Tactics: Mastering Time and Space

The Soviet style is a high-speed game of chess.

### Positioning Strategy:
- At the edge of reach (safety).
- Half a step from engagement (lightning aggression).

### Tactical Principles:
- **Provocation**: Use the jab to force a reaction.
- **Counter-attack**: Always anticipated, never improvised.
- **Exit Punches**: Strike while moving to avoid staying static.
- **Short Combinations**: 3 to 4 quick punches to open the guard.
      `
    }
  ],
  es: [
    {
      id: 'intro',
      title: 'Principios Fundamentales',
      icon: 'Shield',
      content: `
# 🥊 Estilo de Boxeo Soviético: Principios Fundamentales

El estilo soviético se basa en cuatro pilares principales:
- **Relajación**
- **Juego de pies**
- **Trabajo a distancia**
- **Táctica**

Es un estilo centrado en la fluidez, la maestría técnica, la gestión de la distancia y la inteligencia de combate. Su objetivo es maximizar la eficiencia minimizando los riesgos.
      `
    },
    {
      id: 'relachement',
      title: '1. La Relajación',
      icon: 'Wind',
      content: `
# 🔹 1. La relajación: fundamento del estilo

La relajación es la base de todo. Primero concierne al cuerpo, luego, por extensión, a la mente.

Un cuerpo tenso está limitado en sus movimientos, mientras que un cuerpo relajado permite gestos fluidos, rápidos, precisos, un mejor control de la respiración y una mayor adaptabilidad.

Un boxeador tenso obstaculiza su propia mecánica: sus golpes se vuelven rígidos, sus desplazamientos menos efectivos y su respiración menos controlada, lo que lleva a un agotamiento inevitable.

Por el contrario, un boxeador relajado actúa con naturalidad, sin forzar, y esto se nota en cada acción.

> 🧠 **Fuerza Elástica**: Una transferencia de energía fluida desde el suelo hasta el puño, sin ruptura en la cadena muscular.

### ¿Cómo trabajarla?
- Imagina tus brazos y piernas como látigos.
- Mantén los hombros móviles y flexibles.
- Pasa de un estado fluido a uno compacto solo en el momento del impacto.
      `
    },
    {
      id: 'jeu-de-jambes',
      title: '2. Juego de Pies',
      icon: 'Zap',
      content: `
# 🔹 2. El juego de pies: la movilidad como arma

En el estilo soviético, el juego de pies está en perpetuo movimiento. Utilizamos el **"pendulum"** (rebote continuo).

### Objetivos del juego de pies:
1. Mantenerse fuera de alcance.
2. Entrar y salir rápidamente.
3. Crear ángulos de ataque.
4. Desorientar al oponente con fintas.

### Los tres pilares del juego de pies soviético:
- **Rapidez**: Para sorprender y evitar.
- **Potencia**: Para generar impacto sin anclaje total.
- **Resistencia**: Para mantener la movilidad durante todo el combate.
      `
    },
    {
      id: 'distance',
      title: '3. Combate a Distancia',
      icon: 'Target',
      content: `
# 🔹 3. El combate a distancia: velocidad, precisión, control

El estilo soviético favorece el combate a larga distancia. Se evita el cuerpo a cuerpo en favor del control espacial.

### Golpes clave:
- **El Jab**: Para contener, fijar o fintar.
- **El Directo de mano trasera**: A menudo utilizado como contraataque.
- **El Crochet de mano delantera**: Por sorpresa o al salir.

> 🧠 Golpear con relajación y luego contraer en el momento del impacto es mucho más efectivo que un golpe lanzado con fuerza de principio a fin.
      `
    },
    {
      id: 'tactique',
      title: '4. La Táctica',
      icon: 'Brain',
      content: `
# 🔹 4. La táctica: dominar el tiempo y el espacio

El estilo soviético es un juego de ajedrez a alta velocidad.

### Estrategia de posicionamiento:
- Al límite del alcance (seguridad).
- A medio paso del compromiso (agresión relámpago).

### Principios tácticos:
- **Provocación**: Usar el jab para forzar una reacción.
- **Contraataque**: Siempre anticipado, nunca improvisado.
- **Golpes de salida**: Golpear mientras se mueve para no quedarse estático.
- **Combinaciones cortas**: 3 a 4 golpes rápidos para abrir la guardia.
      `
    }
  ]
};
