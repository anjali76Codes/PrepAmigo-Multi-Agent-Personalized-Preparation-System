import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { useAuth, type ExperienceLevel } from '../hooks/useAuth';
import { extractTextFromFile } from '../lib/resumeParser';

export function Profile() {
  const shouldReduceMotion = useReducedMotion();
  const { user, updateProfile } = useAuth();

  const [targetRole, setTargetRole] = useState('');
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel>('fresher');
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [resumeFilename, setResumeFilename] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.profile) {
      setTargetRole(user.profile.target_role || '');
      setExperienceLevel(user.profile.experience_level || 'fresher');
      setSkills(user.profile.skills || []);
      setGithubUrl(user.profile.github_url || '');
      setResumeFilename(user.profile.resume_filename || '');
      setResumeText(user.profile.resume_text || '');
    }
  }, [user]);

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'JD';

  const handleAddSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      setSkills((prev) => [...prev, trimmed]);
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
  };

  const handleSkillKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddSkill(skillInput);
    }
  };

  const handleFileUpload = async (file: File) => {
    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'txt', 'md'].includes(ext || '')) {
      setResumeError('Please upload a PDF, DOCX, TXT, or MD file.');
      return;
    }

    setResumeError(null);
    setIsUploadingResume(true);

    try {
      const extractedText = await extractTextFromFile(file);
      setResumeFilename(name);
      setResumeText(extractedText);
    } catch (err: any) {
      console.error('Resume upload failed:', err);
      setResumeError(err.message || 'Failed to process resume file.');
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    const success = await updateProfile({
      target_role: targetRole.trim(),
      experience_level: experienceLevel,
      skills,
      github_url: githubUrl.trim(),
      resume_filename: resumeFilename,
      resume_text: resumeText,
    });

    setIsSaving(false);
    if (success) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-bg h-full overflow-hidden text-carbon-700">
      <div className="bg-bg shrink-0 z-10 sticky top-0 px-4 md:px-8 py-8 md:py-12 border-b border-border">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-extrabold text-carbon-900 mb-2 tracking-tight">Profile</h1>
          <p className="text-lg text-carbon-500">Manage your profile, target preferences, and resume.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 relative safe-area-bottom">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-3xl mx-auto space-y-8 pb-12"
        >
          {/* Account Info */}
          <div className="bg-white rounded-[2rem] p-8 border border-border shadow-sm">
            <h3 className="text-2xl font-bold text-carbon-900 mb-6 flex items-center gap-3">
              <Icon name="person" className="text-chrome-accent" />
              Account Info
            </h3>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-lavender-100 flex items-center justify-center text-chrome text-2xl font-bold">
                {userInitials}
              </div>
              <div>
                <h4 className="font-bold text-carbon-900 text-lg">{user?.name || 'Candidate'}</h4>
                <p className="text-carbon-500 text-sm">{user?.email || 'user@example.com'}</p>
              </div>
            </div>
          </div>

          {/* Profile & Calibration */}
          <div className="bg-white rounded-[2rem] p-8 border border-border shadow-sm space-y-6">
            <h3 className="text-2xl font-bold text-carbon-900 flex items-center gap-3">
              <Icon name="briefcase-outline" className="text-chrome-accent" />
              Target Role & Experience
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-carbon-900 mb-2">Target Role</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Frontend Engineer"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-carbon-900 text-sm font-medium focus:outline-none focus:border-chrome transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-carbon-900 mb-2">Experience Level</label>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value as ExperienceLevel)}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-carbon-900 text-sm font-medium focus:outline-none focus:border-chrome transition-colors"
                >
                  <option value="student">Student / Self-Taught (Internship & Entry)</option>
                  <option value="fresher">Fresher (&lt; 1 yr, Associate level)</option>
                  <option value="experienced">Experienced (1+ yrs, Mid/Senior level)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-carbon-900 mb-2">GitHub Profile</label>
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

            <div>
              <label className="block text-sm font-bold text-carbon-900 mb-2">Core Skills & Technologies</label>
              <div className="flex flex-wrap gap-1.5 items-center p-2.5 bg-bg border border-border rounded-xl min-h-[48px]">
                {skills.map((skill) => (
                  <span
                    key={skill}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-border rounded-full text-xs font-bold text-navy-800 shadow-2xs"
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
                  placeholder={skills.length === 0 ? "Type a skill and press Enter..." : "Add skill..."}
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={handleSkillKeyDown}
                  className="bg-transparent text-sm text-carbon-900 outline-none flex-1 min-w-[120px] px-1"
                />
              </div>
            </div>
          </div>


          {/* Context & Resume Baseline */}
          <div className="bg-white rounded-[2rem] p-8 border border-border shadow-sm space-y-6">
            <h3 className="text-2xl font-bold text-carbon-900 flex items-center gap-3">
              <Icon name="document-text" className="text-chrome-accent" />
              Resume Baseline
            </h3>

            <div>
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
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                  resumeFilename
                    ? "border-green-500 bg-green-50/40"
                    : "border-border bg-bg hover:border-chrome"
                }`}
              >
                {isUploadingResume ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-carbon-600">
                    <Icon name="sync-outline" className="animate-spin text-chrome" />
                    <span>Processing resume...</span>
                  </div>
                ) : resumeFilename ? (
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3 text-left">
                      <Icon name="checkmark-circle" className="text-green-600 text-2xl" />
                      <div>
                        <div className="font-bold text-carbon-900">{resumeFilename}</div>
                        <div className="text-xs text-green-700">Resume uploaded and available for skill gap analysis</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setResumeFilename('');
                        setResumeText('');
                      }}
                      className="text-xs text-red-500 hover:underline"
                    >
                      Replace
                    </button>
                  </div>
                ) : (
                  <div>
                    <Icon name="cloud-upload-outline" className="text-3xl text-carbon-400 mx-auto mb-2" />
                    <p className="text-carbon-900 font-semibold text-sm">Upload Resume (PDF, DOCX)</p>
                    <p className="text-xs text-carbon-500 mt-1">Calibrates your personal skill gap analysis across preps</p>
                  </div>
                )}
              </div>
              {resumeError && <p className="text-xs text-red-500 mt-2">{resumeError}</p>}
            </div>

            <div className="pt-2 flex items-center justify-between">
              {saveSuccess && (
                <span className="text-sm font-bold text-green-600 flex items-center gap-1.5">
                  <Icon name="checkmark-circle" className="text-base" /> Profile saved successfully!
                </span>
              )}
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={isSaving}
                className="ml-auto px-8 rounded-xl font-bold"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
