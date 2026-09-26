/**
 * Skill Normalizer Utility
 * Normalizes variations, acronyms, and synonyms into canonical representations.
 */

const SYNONYM_MAP: Record<string, string> = {
  // Frontend
  "react.js": "React",
  "reactjs": "React",
  "react js": "React",
  "react": "React",
  "vue.js": "Vue.js",
  "vuejs": "Vue.js",
  "vue js": "Vue.js",
  "vue": "Vue.js",
  "angular.js": "Angular",
  "angularjs": "Angular",
  "angular": "Angular",
  "next.js": "Next.js",
  "nextjs": "Next.js",
  "next js": "Next.js",
  "nuxt.js": "Nuxt.js",
  "nuxtjs": "Nuxt.js",
  "svelte": "Svelte",

  // Languages
  "js": "JavaScript",
  "javascript": "JavaScript",
  "ts": "TypeScript",
  "typescript": "TypeScript",
  "py": "Python",
  "python": "Python",
  "c#": "C#",
  "csharp": "C#",
  "c sharp": "C#",
  "c++": "C++",
  "cpp": "C++",
  "golang": "Go",
  "go lang": "Go",
  "go": "Go",
  "rb": "Ruby",
  "ruby": "Ruby",

  // Backend & Databases
  "node.js": "Node.js",
  "nodejs": "Node.js",
  "node js": "Node.js",
  "node": "Node.js",
  "express.js": "Express.js",
  "expressjs": "Express.js",
  "express": "Express.js",
  "postgres": "PostgreSQL",
  "postgresql": "PostgreSQL",
  "postgres db": "PostgreSQL",
  "mongo": "MongoDB",
  "mongodb": "MongoDB",
  "redis": "Redis",
  "my sql": "MySQL",
  "mysql": "MySQL",
  "ms sql": "SQL Server",
  "mssql": "SQL Server",
  "sql server": "SQL Server",

  // Cloud & Infrastructure
  "gcp": "Google Cloud Platform",
  "google cloud": "Google Cloud Platform",
  "google cloud platform": "Google Cloud Platform",
  "aws": "Amazon Web Services",
  "amazon web services": "Amazon Web Services",
  "azure": "Microsoft Azure",
  "microsoft azure": "Microsoft Azure",
  "k8s": "Kubernetes",
  "kubernetes": "Kubernetes",
  "docker": "Docker",
  "containerization": "Docker",
  "terraform": "Terraform",
  "tf": "Terraform",
  "ansible": "Ansible",

  // APIs & Architecture
  "rest": "REST APIs",
  "restful": "REST APIs",
  "rest api": "REST APIs",
  "restful api": "REST APIs",
  "graphql": "GraphQL",
  "grpc": "gRPC",
  "ci/cd": "CI/CD",
  "ci cd": "CI/CD",
  "continuous integration": "CI/CD",
  "microservices": "Microservices",

  // AI/ML & Data
  "ml": "Machine Learning",
  "machine learning": "Machine Learning",
  "ai": "Artificial Intelligence",
  "artificial intelligence": "Artificial Intelligence",
  "dl": "Deep Learning",
  "deep learning": "Deep Learning",
  "llm": "LLMs",
  "llms": "LLMs",
  "nlp": "NLP",
  "natural language processing": "NLP",
};

/**
 * Normalizes a raw skill string to its canonical name.
 */
export function normalizeSkillName(rawName: string): string {
  if (!rawName || typeof rawName !== "string") return "";

  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase().replace(/^[.\s-]+|[.\s-]+$/g, "");

  if (SYNONYM_MAP[lower]) {
    return SYNONYM_MAP[lower];
  }

  // Handle generic variations like "React JS Framework" or "PostgreSQL Database"
  for (const [key, canonical] of Object.entries(SYNONYM_MAP)) {
    if (lower === key || lower.startsWith(`${key} `) || lower.endsWith(` ${key}`)) {
      return canonical;
    }
  }

  // Proper Title Case formatting for unknown skills
  return trimmed
    .split(/\s+/)
    .map((word) => {
      if (word.length <= 3 && word.toUpperCase() === word) return word; // keep acronyms like SEO, AWS
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}
