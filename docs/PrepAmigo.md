# **PrepAmigo** 

### **Multi-Agent Personalized Preparation System** 

## **Problem Statement** 

Preparing for a company-specific interview is not just about studying more. The real problem is knowing **what to study, what to prioritize, and how to use limited preparation time** . 

Candidates usually have to manually research company interview patterns, job requirements, candidate experiences, learning resources, and technical topics, then compare all of this against their own resume and current skill level. This creates a fragmented preparation process where candidates often spend more time deciding **what to prepare** than actually preparing. 

The real problem is not finding learning resources. It is **coordinating company requirements, candidate gaps, available preparation time, and learning activities into one adaptive preparation system.** 

## **Solution** 

**PrepAmigo is an agentic learning orchestration system that creates and manages a personalized preparation journey for a specific company, role, and timeframe.** 

The candidate provides: 

- Target company and role 

- Preparation timeframe 

- Resume 

- Current knowledge, strengths, and weaknesses 

At the centre is a single PrepAmigo interface. The candidate tells the system what they are preparing for, while a **network of specialized agents** handles the underlying research, analysis, planning, resource discovery, assessment, and adaptation. 

The system maintains a shared **Learning Context** containing the target role, company information, job requirements, interview patterns, candidate skills, resume, knowledge gaps, preparation deadline, completed topics, resources, progress, and learning constraints. 

## **Specialized Agents** 

1. **Company Research Agent** - company products, technology, engineering areas, recent developments, and relevant information 

2. **Job Intelligence Agent** - analyzes job descriptions and identifies recurring skills, technologies and requirements 

3. **Interview Intelligence Agent** - researches interview rounds, commonly reported topics, question patterns and candidate experiences 

4. **Skill Gap Agent** - compares company/role requirements against the candidate's resume and current state 

5. **Research Agent** - finds technical explanations, documentation, articles and learning material 

6. **Assessment Agent** - evaluates progress through quizzes, coding tasks and mock interviews 

7. **Planner Agent** - converts all findings into sprints, daily tasks, calendar plans and revision cycles 

8. **Progress Agent** - tracks completion, performance, streaks, XP, badges and learning velocity 

## **How It Works** 

The system researches the target company and role, understands the candidate's current state, identifies the highest-impact gaps, and creates a preparation plan around the available timeframe. 

As the candidate completes tasks or performs poorly in an assessment, PrepAmigo updates the Learning Context and adjusts upcoming sprints and priorities. 

## **Example** 

**"I have 45 days to prepare for a Software Engineer role at Company X. Here's my resume. I'm strong in React and Node.js but weak in DSA and system design."** 

Instead of simply generating a study timetable, PrepAmigo determines: 

**What the company expects → What the candidate already knows → What gaps matter most → What should be learned → Which resources to use → What should be practiced → How much time each topic deserves → What should be revised before the interview** 

## **Gamification** 

PrepAmigo turns preparation into a measurable progression system through: 

**Streaks · XP · Badges · Trophies · Titles · Sprint Completion · Skill Levels · Milestones** 

Progress is based on actual preparation activity and assessment performance rather than simply spending time in the application. 

## **USP** 

A single preparation interface backed by specialized agents and a shared Learning Context that understands **what a company expects, what a candidate already knows, what they are missing, and how much time they have** , then continuously coordinates research, learning, practice, assessment, and planning around that goal. 

**Tell PrepAmigo where you want to go. It figures out what you need to learn next.** 

### **1. Company Research Agent** 

**Goal:** Research company products, technology, engineering areas, recent developments, and relevant culture/background information for downstream agents (Skill Gap, Planner, Interview Intelligence) in the shared Learning Context.

> **Why only 2 APIs?**
> The Google Search API response already bundles the knowledge graph (structured facts), organic results (engineering blogs and tech stack), related questions (culture/expectation signals), and discussions & forums (candid Reddit/Blind-style chatter) into a single call. Together with the Google News API covering recent developments (launches, acquisitions, funding), these 2 endpoints replace the need for separate Trends, Forums, Images, AI Overview, and Finance calls for this agent's scope, reducing latency and quota consumption.

- **Google Search API (Primary — Company Facts, Products, Tech Stack, Culture):**
  - **Endpoint:** `GET https://serpapi.com/search.json`
  - **Required Params:** `engine=google`, `q`, `api_key`
  - **Recommended Params:** `num=10`, `hl=en`, `gl=us`
  - **Response fields stored in Learning Context:**
    - `knowledge_graph`: Structured facts (industry, founded, HQ, description)
    - `organic_results[]`: Titles, links, snippets (engineering blogs, docs, career pages)
    - `related_questions[]`: Questions, snippets (culture/expectation signals)
    - `discussions_and_forums[]`: Titles, links, sources (Reddit/Blind-style chatter)

- **Google News API (Recent Developments — Launches, Funding, Announcements):**
  - **Endpoint:** `GET https://serpapi.com/search.json`
  - **Required Params:** `engine=google_news`, `q`, `api_key`
  - **Recommended Params:** `gl=us`, `hl=en`
  - **Response fields stored in Learning Context:**
    - `news_results[]`: Titles, links, sources, dates, snippets 

### **2. Job Intelligence Agent** 

**Goal:** Analyze target job descriptions and identify recurring skills, technologies, responsibilities, and core requirements. 

- **Google Jobs API:** Primary source for collecting current job descriptions. 

- **Google Search API:** Find additional company career pages and job descriptions. 

- **Google Related Questions API:** Discover related job/career questions and requirements. 

### **3. Skill Gap Agent** 

**Goal:** Compare the candidate's resume and current skill set against the target company and 

role requirements to identify missing areas. 

- **Google Jobs API:** Obtain actual requirements for target roles. 

- **Google Search API:** Validate technologies, skills, and expected competencies. 

### **4. Planner Agent** 

**Goal:** Build a structured, milestone-driven preparation roadmap and study schedule based on company data, role requirements, and identified skill gaps. 

- _Uses fetched info from:_ Company Research, Job Intelligence, and Skill Gap Agents. 

- **Core Function:** Synthesizes timelines, breaks down topics into weekly/daily goals, and prioritizes missing skills for efficient prep. 

### **5. Research Agent** 

**Goal:** Find technical explanations, documentation, articles, research, and learning materials needed to bridge skill gaps. 

- **Google Search API:** Find documentation, tutorials, engineering blogs, technical articles, etc. 

- **Google Books API / Google Play Books API:** Find technical books and references. 

- **Google Videos API / YouTube Search API:** Find relevant educational and technical videos. 

- **YouTube Video API / YouTube Video Transcript API:** Retrieve video metadata and extract transcripts for summarization and learning. 

- **YouTube Channel API:** Find useful educational channels and their content. 

### **6. Assessment Agent** 

**Goal:** Test candidate knowledge, evaluate proficiency in required technologies, and simulate technical or behavioral problem-solving. 

- _Uses fetched info from:_ Job Intelligence, Skill Gap, and Research Agents. 

- **Core Function:** Generates practice quizzes, coding challenges, mock problem sets, and evaluates performance against role standards. 

### **7. Interview Intelligence Agent** 

**Goal:** Research specific interview rounds, reported topics, question patterns, and candidate experiences for the target company/role. 

- **Google Forums API:** Find candidate discussions and interview experiences. 

- **YouTube Search API / Video API:** Find interview walkthroughs, coding round breakdowns, and candidate experience videos. 

- **Google Related Questions API:** Discover common interview-related questions. 

- **Google News API:** Track publicly reported changes in hiring/interview processes. 

### **8. Progress Agent** 

**Goal:** Track overall preparation progress, completed study modules, application milestones, and overall interview readiness over time. 

- _Uses fetched info from:_ All preceding agents and user milestones. 

- **Core Function:** Aggregates completion rates, updates the study schedule dynamically, and monitors job application statuses. 

