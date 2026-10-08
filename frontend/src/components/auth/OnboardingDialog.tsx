import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "../ui/Icon";
import { Button } from "../ui/Button";
import { Mascot } from "../ui/Mascot";
import { useAuth, type ExperienceLevel, type UserProfile } from "../../hooks/useAuth";

interface OnboardingDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const COMMON_ROLES = [
  "Full Stack Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Data Engineer",
];

const SUGGESTED_SKILLS = [
  "React",
  "TypeScript",
  "Node.js",
  "Python",
  "System Design",
  "Algorithms & Data Structures",
  "SQL",
  "AWS",
  "Docker",
  "Go",
];

export function OnboardingDialog({ isOpen, onClose }: OnboardingDialogProps) {
  const { user, updateProfile } = useAuth();
  const [targetRole, setTargetRole] = useState(user?.profile?.target_role || "");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>(
    user?.profile?.experience_level || "fresher"
  );
  const [skills, setSkills] = useState<string[]>(user?.profile?.skills || []);
  const [skillInput, setSkillInput] = useState("");
  const [githubUrl, setGithubUrl] = useState(user?.profile?.github_url || "");
  const [resumeFilename, setResumeFilename] = useState(user?.profile?.resume_filename || "");
  const [resumeText, setResumeText] = useState(user?.profile?.resume_text || "");
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (user?.profile) {
      if (user.profile.target_role) setTargetRole(user.profile.target_role);
      if (user.profile.experience_level) setExperienceLevel(user.profile.experience_level);
      if (Array.isArray(user.profile.skills) && user.profile.skills.length > 0) setSkills(user.profile.skills);
      if (user.profile.github_url) setGithubUrl(user.profile.github_url);
      if (user.profile.resume_filename) setResumeFilename(user.profile.resume_filename);
      if (user.profile.resume_text) setResumeText(user.profile.resume_text);
    }
  }, [user]);

  if (!isOpen) return null;

  const handleAddSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput("");
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddSkill(skillInput);
    }
  };

  const handleFileUpload = async (file: File) => {
    const name = file.name;
    const ext = name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt", "md"].includes(ext || "")) {
      setResumeError("Please upload a PDF, DOCX, TXT, or MD file.");
      return;
    }

    setResumeError(null);
    setIsUploadingResume(true);

    try {
      if (ext === "txt" || ext === "md") {
        const text = await file.text();
        setResumeFilename(name);
        setResumeText(text);
      } else {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const res = reader.result as string;
            const base64 = res.split(",")[1] || "";
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const response = await fetch(`${apiUrl}/api/agent/parse-resume`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: name, base64Data: base64 }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({ error: "Failed to extract text" }));
          throw new Error(errData.error || `Server returned ${response.status}`);
        }

        const data = await response.json();
        setResumeFilename(name);
        setResumeText(data.text || "");
      }
    } catch (err: any) {
      console.error("Resume upload failed:", err);
      setResumeError(err.message || "Failed to process resume file.");
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const profilePayload: Partial<UserProfile> = {
      target_role: targetRole.trim(),
      experience_level: experienceLevel,
      skills,
      github_url: githubUrl.trim(),
      resume_filename: resumeFilename,
      resume_text: resumeText,
    };

    const success = await updateProfile(profilePayload);
    setIsSaving(false);
    if (success) {
      if (user) {
        const userKey = user.id || user.sub;
        sessionStorage.removeItem(`prepamigo_onboarding_skipped_${userKey}`);
      }
      sessionStorage.removeItem("prepamigo_onboarding_skipped");
      onClose();
    }
  };

  const handleSkip = () => {
    if (user) {
      const userKey = user.id || user.sub;
      sessionStorage.setItem(`prepamigo_onboarding_skipped_${userKey}`, "true");
    }
    sessionStorage.removeItem("prepamigo_onboarding_skipped");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-deep-emerald/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-[2rem] shadow-2xl border border-border w-full max-w-2xl overflow-hidden my-8"
        >
          {/* Header Banner */}
          <div className="bg-deep-emerald text-white p-6 md:p-8 relative overflow-hidden">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-extrabold tracking-wider text-chrome-accent">
                  Welcome to PrepAmigo
                </span>
                <h2 className="text-2xl md:text-3xl font-extrabold mt-1 tracking-tight">
                  Personalize Your Prep
                </h2>
                <p className="text-sm text-navy-200 mt-1 max-w-md">
                  Help the AI agents tailor roadmap pacing, study materials, and skill gaps specifically for you.
                </p>
              </div>
              <div className="hidden sm:block shrink-0">
                <Mascot variant="Celebration.png" size="md" />
              </div>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 md:p-8 space-y-6 max-h-[70vh] overflow-y-auto text-carbon-800">
            {/* 1. Target Role */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-carbon-900">
                Target Role <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Senior Frontend Engineer"
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-carbon-900 font-medium focus:outline-none focus:border-chrome transition-colors"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                {COMMON_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setTargetRole(role)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${targetRole === role
                      ? "bg-expresso text-white border-expresso"
                      : "bg-surface text-carbon-600 border-border hover:bg-lavender-100"
                      }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Experience Level */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-carbon-900">
                Experience Level
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { id: "student" as const, title: "Student / Self-Taught", desc: "First internship or entry role" },
                  { id: "fresher" as const, title: "Fresher (< 1 yr)", desc: "Junior / Associate level" },
                  { id: "experienced" as const, title: "Experienced (1+ yrs)", desc: "Mid / Senior level mastery" },
                ].map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => setExperienceLevel(level.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${experienceLevel === level.id
                      ? "border-chrome bg-lavender-100 shadow-sm"
                      : "border-border bg-bg hover:border-chrome/50"
                      }`}
                  >
                    <div className="font-bold text-sm text-carbon-900">{level.title}</div>
                    <div className="text-xs text-carbon-500 mt-0.5">{level.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Core Skills */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-carbon-900">
                Core Skills & Tools
              </label>
              <div className="flex flex-wrap gap-1.5 items-center p-2.5 bg-bg border border-border rounded-xl min-h-[48px]">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-border rounded-full text-xs font-bold text-forest-emerald shadow-2xs"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="text-carbon-400 hover:text-red-500 transition-colors"
                    >
                      <Icon name="close" className="text-xs" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={skills.length === 0 ? "Type a skill and press Enter..." : "Add more..."}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  className="bg-transparent text-sm text-carbon-900 outline-none flex-1 min-w-[120px] px-1"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {SUGGESTED_SKILLS.filter((s) => !skills.includes(s)).slice(0, 6).map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleAddSkill(skill)}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-surface text-carbon-600 hover:bg-lavender-100 transition-colors"
                  >
                    + {skill}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Resume Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-bold text-carbon-900">
                Resume (Optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileUpload(file);
                }}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${resumeFilename
                  ? "border-green-500 bg-green-50/50"
                  : "border-border bg-bg hover:border-chrome"
                  }`}
              >
                {isUploadingResume ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-carbon-600 py-2">
                    <Icon name="sync-outline" className="animate-spin text-chrome" />
                    <span>Extracting skills and experience from resume...</span>
                  </div>
                ) : resumeFilename ? (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2 text-left">
                      <Icon name="checkmark-circle" className="text-green-600 text-xl" />
                      <div>
                        <div className="text-sm font-bold text-carbon-900">{resumeFilename}</div>
                        <div className="text-xs text-green-700">Resume parsed and ready for skill gap calibration</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setResumeFilename("");
                        setResumeText("");
                      }}
                      className="text-xs text-red-500 hover:underline ml-4"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="py-2">
                    <Icon name="cloud-upload-outline" className="text-2xl text-carbon-400 mx-auto mb-1" />
                    <div className="text-sm font-semibold text-carbon-800">
                      Upload your resume to calibrate skill gaps
                    </div>
                    <div className="text-xs text-carbon-500 mt-0.5">PDF or DOCX up to 5MB</div>
                  </div>
                )}
              </div>
              {resumeError && <p className="text-xs text-red-500">{resumeError}</p>}
            </div>

            {/* 5. GitHub URL */}
            <div className="space-y-1">
              <label className="block text-sm font-bold text-carbon-900">
                GitHub Profile (Optional)
              </label>
              <div className="flex items-center bg-bg border border-border rounded-xl px-3 py-2.5">
                <Icon name="logo-github" className="text-lg text-carbon-500 mr-2" />
                <input
                  type="url"
                  placeholder="https://github.com/username"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  className="bg-transparent text-sm text-carbon-900 outline-none w-full"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-6 bg-surface border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm font-semibold text-carbon-500 hover:text-carbon-800 transition-colors"
            >
              Skip for now
            </button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={isSaving || !targetRole.trim()}
              className="px-6 rounded-xl font-bold"
            >
              {isSaving ? "Saving..." : "Save & Start Prepping"}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
