<div align="center">
  <h1>🔵 Echo</h1>
  <h3>Decision Blind Spot Detector</h3>
  <p><i>Every policy has blind spots. Echo finds them.</i></p>
  <br />
</div>

## 📖 Overview

**73% of policy failures trace back to overlooked stakeholders.** In government, institutions, and corporations, the loudest voices shape decisions, while the most affected voices are rarely heard.

**Echo** is an AI-powered Decision Blind Spot Detector. It doesn't tell you what decision to make; it tells you whose voice is missing from the room. By analyzing proposed decisions, Echo automatically discovers affected stakeholders, flags hidden conflicts, quantifies fairness, and even suggests an improved "Shadow Policy" — ensuring that no community is left behind.

Built for the **ZenysLab HackPrix (June 2026)**.

---

## ✨ Core Features

- 👁️ **Who Did We Forget?** - Echo instantly detects communities that are structurally overlooked by a proposed policy (e.g., rural workers, caregivers, disabled individuals).
- 📊 **Equity Index Score** - An automated algorithmic score (0-100) that drops when stakeholders are forgotten or when high-severity negative impacts are detected.
- 💬 **Live Stakeholder Debate** - Echo uses Groq to generate distinct AI personas for each affected group and ElevenLabs' ultra-realistic text-to-speech to let you hear their exact concerns and conflicts.
- 📝 **Shadow Policy Generator** - If a policy is deeply flawed, Echo's AI will automatically draft an improved, equitable "Shadow Policy" that explicitly includes the forgotten groups and resolves internal conflicts.
- 🎙️ **Trilingual Voice Input** - Speak your policy proposal naturally. Echo features native voice-to-text transcription in **English, Hindi, and Telugu**.
- 🔗 **Solana Accountability Ledger** - All analyses and shadow policies are hashed and permanently logged to the Solana blockchain, creating an immutable, public record of organizational accountability.

---

## 🛠️ Tech Stack

Echo is built with a modern, highly scalable architecture splitting a fluid mobile-first frontend with a secure AI proxy backend.

### Frontend
- **React Native / Expo Web:** Cross-platform fluid UI with responsive layouts.
- **TypeScript:** Strict type safety and robust data models.
- **Solana Web3.js:** For client-side blockchain transaction logging.

### Backend & Database
- **Node.js & Express:** Custom proxy server to protect API keys and handle heavy data formatting.
- **MongoDB:** High-performance history and document storage for all generated simulations.

### AI & APIs
- **Gemini 2.0 Flash:** Advanced multimodal reasoning and contextual intelligence for policy impact analysis.
- **Groq AI (LLaMA 3.1 8B):** Lightning-fast inference engine used for rapid stakeholder analysis, policy generation, and language translation.
- **Sarvam AI:** State-of-the-art transcription specifically tuned for Indian languages (Hindi, Telugu).
- **ElevenLabs:** Ultra-realistic, emotive voice synthesis for the live stakeholder debate.

### Deployment
- **Vultr:** Dedicated cloud hosting for the Node.js backend.
- **Vercel:** Edge hosting for the static Expo Web frontend.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB connection string
- API Keys for: Groq, Sarvam AI, and ElevenLabs
- Phantom Wallet (or any Solana wallet for devnet testing)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/f4w4z/zenyslab-hackprix-submission.git
   cd zenyslab-hackprix-submission
   ```

2. **Install dependencies:**
   ```bash
   npm install
   cd server && npm install
   cd ..
   ```

3. **Set up Environment Variables:**
   Create a `.env` file in the root directory and add:
   ```env
   # API Keys
   GROQ_API_KEY=your_groq_api_key
   SARVAM_API_KEY=your_sarvam_api_key
   ELEVENLABS_API_KEY=your_elevenlabs_api_key

   # MongoDB
   MONGODB_URI=your_mongodb_connection_string

   # Solana Configuration
   EXPO_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
   EXPO_PUBLIC_PROGRAM_ID=your_deployed_program_id
   ```

4. **Start the Development Servers:**
   Open two terminal windows.
   
   Terminal 1 (Backend):
   ```bash
   cd server
   npm run dev
   ```

   Terminal 2 (Frontend):
   ```bash
   npm run web
   ```

5. **Open in Browser:**
   Navigate to `http://localhost:8081` (or the port specified by Expo) to use the app.

---

## 🧠 How it Works (Architecture Flow)

1. **Input:** User speaks a policy in Hindi, Telugu, or English.
2. **Transcription:** Audio is sent to the Express proxy, which forwards it to Sarvam AI for highly accurate text transcription.
3. **Refinement:** The raw text is passed to Gemini 2.0 Flash to fix grammar and deduce the exact policy intent.
4. **Analysis:** Gemini executes a massive parallel prompt to identify stakeholders, severities, and conflicts. 
5. **Localization:** The analysis is instantly translated into the user's selected language using Gemini's JSON formatting capabilities.
6. **Storage & Logging:** The simulation is saved to MongoDB, and a cryptographic hash of the policy is minted to the Solana Devnet for public verification.

---

<div align="center">
  <p><b>Built with ❤️ from ZenysLab for HackPrix</b></p>
</div>
