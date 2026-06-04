import React, { useState, useEffect, useRef } from 'react';

// Setup Mock Datasets for instant click-and-run testing
const MOCK_RESUME = `Alex Rivera
alex.rivera@email.com | (555) 019-2834 | San Francisco, CA | portfolio.design/alex

PROFESSIONAL SUMMARY
Dedicated Product Designer with 6+ years of experience building scalable SaaS applications. Expert in crafting user-centric interfaces and leading design strategy from concept to launch. Passionate about AI-augmented design workflows.

SKILLS
Figma Expert, HTML, CSS, JavaScript, React, Adobe Creative Suite, Visual Design, Prototyping

WORK EXPERIENCE
Lead Designer | FintechFlow | 2020 - Present
- Architected a cross-platform design system for core banking applications, reducing front-end development time by 40%.
- Directed a team of 4 designers to launch a new consumer lending mobile app, achieving a 4.8 App Store rating.
- Implemented state management using Redux and styled layouts with basic CSS.

Senior UI Designer | PixelPerfect | 2017 - 2020
- Implemented atomic design principles to overhaul legacy interface components for better accessibility.
- Designed high-fidelity prototypes and collaborated with engineering teams.

EDUCATION
Bachelor of Science in Product Design
University of California, Berkeley | 2017
`;

const MOCK_JD = `Senior Product Designer

We are looking for a high-performance Product Designer to lead our AI-driven SaaS workflows. Must have experience with Scalable Design Systems, Bento Grids, Data-Driven Iteration, and High-Fidelity Prototyping. Familiarity with Figma and Tailwind CSS is a major plus. You will collaborate with engineering teams to deliver world-class user experiences.
`;

export default function App() {
  // Screen state
  const [currentScreen, setCurrentScreen] = useState('ingestion'); // ingestion | workspace
  const [activeNavTab, setActiveNavTab] = useState('editor'); // editor | analysis | json
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('Try adding "Bento Grids" to your experience section to increase match score.');
  const [showToast, setShowToast] = useState(true);

  // Form Inputs
  const [rawResume, setRawResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [userInstructions, setUserInstructions] = useState('');

  // Structured API Results
  const [results, setResults] = useState(null);

  // File Ingestion & Recent Resumes state
  const [activeFilename, setActiveFilename] = useState('');
  const [recentResumes, setRecentResumes] = useState([
    { filename: 'UI_UX_Designer_Rivera.pdf', text: MOCK_RESUME, score: '82%' },
    { filename: 'Lead_Engineer_CV.docx', text: MOCK_RESUME, score: '92%' }
  ]);
  const fileInputRef = useRef(null);

  const currentResumeItem = recentResumes.find(item => item.filename === activeFilename);
  const currentScore = currentResumeItem ? currentResumeItem.score : (results ? `${results.analysis.overall_compatibility_score}%` : null);

  const triggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await parseFile(file);
  };

  const parseFile = async (file) => {
    setError('');
    setIsLoading(true);
    
    try {
      const filename = file.name;
      const extension = filename.split('.').pop().toLowerCase();
      
      if (extension === 'txt') {
        const reader = new FileReader();
        reader.onload = (evt) => {
          setRawResume(evt.target.result);
          setActiveFilename(filename);
          setIsLoading(false);
        };
        reader.onerror = () => {
          setError('Failed to read plain text file.');
          setIsLoading(false);
        };
        reader.readAsText(file);
      } else if (extension === 'pdf' || extension === 'docx') {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/parse', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to parse file.');
        
        setRawResume(data.text);
        setActiveFilename(data.filename);
      } else {
        throw new Error('Unsupported file extension. Please upload .pdf, .docx, or .txt files.');
      }
    } catch (err) {
      setError(`File Ingestion Failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSampleProject = () => {
    setRawResume(MOCK_RESUME.trim());
    setJobDescription(MOCK_JD.trim());
    setUserInstructions("Focus on design systems, bento grids, and high-fidelity prototyping. Tailor experience to match Fintech and SaaS terminology.");
  };

  const handleClear = () => {
    setRawResume('');
    setJobDescription('');
    setUserInstructions('');
    setError('');
  };

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault();
    if (!rawResume || !jobDescription) {
      setError('Please provide both your Resume and the Target Job Description.');
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rawResume,
          jobDescription,
          userInstructions
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred during resume analysis.');
      }

      setResults(data);
      setCurrentScreen('workspace');
      setActiveNavTab('editor');

      // Update recentResumes list with the new score
      const newScore = `${data.analysis.overall_compatibility_score}%`;
      const currentFilename = activeFilename || 'Pasted_Resume.txt';
      setRecentResumes(prev => {
        const existsIdx = prev.findIndex(item => item.filename === currentFilename);
        if (existsIdx > -1) {
          const updated = [...prev];
          updated[existsIdx] = { ...updated[existsIdx], score: newScore, text: rawResume };
          return updated;
        } else {
          return [{ filename: currentFilename, text: rawResume, score: newScore }, ...prev.slice(0, 3)];
        }
      });
      
      // Load first formatting feedback into toast if available
      if (data.analysis?.formatting_feedback?.length > 0) {
        setToastMessage(data.analysis.formatting_feedback[0]);
        setShowToast(true);
      } else if (data.analysis?.critical_gaps?.length > 0) {
        setToastMessage(`Gap Alert: ${data.analysis.critical_gaps[0]}`);
        setShowToast(true);
      }
    } catch (err) {
      setError(err.message || 'Connection failed. Please ensure the backend server is running.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Inline editor field changes updater
  const updatePersonalInfo = (field, val) => {
    if (!results) return;
    setResults({
      ...results,
      tailored_resume: {
        ...results.tailored_resume,
        personal_info: {
          ...results.tailored_resume.personal_info,
          [field]: val
        }
      }
    });
  };

  const updateSummary = (val) => {
    if (!results) return;
    setResults({
      ...results,
      tailored_resume: {
        ...results.tailored_resume,
        professional_summary: val
      }
    });
  };

  const updateWorkExp = (index, field, val) => {
    if (!results) return;
    const updatedExp = [...results.tailored_resume.work_experience];
    updatedExp[index] = {
      ...updatedExp[index],
      [field]: val
    };
    setResults({
      ...results,
      tailored_resume: {
        ...results.tailored_resume,
        work_experience: updatedExp
      }
    });
  };

  const updateWorkBullet = (expIndex, bulletIndex, val) => {
    if (!results) return;
    const updatedExp = [...results.tailored_resume.work_experience];
    const updatedBullets = [...updatedExp[expIndex].bullet_points];
    updatedBullets[bulletIndex] = val;
    updatedExp[expIndex] = {
      ...updatedExp[expIndex],
      bullet_points: updatedBullets
    };
    setResults({
      ...results,
      tailored_resume: {
        ...results.tailored_resume,
        work_experience: updatedExp
      }
    });
  };

  // Helper copy handlers
  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    alert(`${type} copied to clipboard successfully!`);
  };

  const buildPlainText = () => {
    if (!results || !results.tailored_resume) return '';
    const r = results.tailored_resume;
    let t = `${r.personal_info.name}\n`;
    t += `${r.personal_info.email} | ${r.personal_info.phone} | ${r.personal_info.linkedin} | ${r.personal_info.location}\n\n`;
    t += `PROFESSIONAL SUMMARY\n${r.professional_summary}\n\n`;
    t += `SKILLS\n${r.skills.join(', ')}\n\n`;
    t += `EXPERIENCE\n`;
    r.work_experience.forEach(exp => {
      t += `${exp.company} - ${exp.role} (${exp.duration})\n`;
      t += `${exp.location}\n`;
      exp.bullet_points.forEach(bullet => {
        t += `- ${bullet}\n`;
      });
      t += `\n`;
    });
    t += `EDUCATION\n`;
    r.education.forEach(edu => {
      t += `${edu.institution} - ${edu.degree} (${edu.graduation_year})\n`;
    });
    return t;
  };

  const buildMarkdown = () => {
    if (!results || !results.tailored_resume) return '';
    const r = results.tailored_resume;
    let md = `# ${r.personal_info.name}\n`;
    md += `**Email:** ${r.personal_info.email} | **Phone:** ${r.personal_info.phone} | **LinkedIn:** ${r.personal_info.linkedin} | **Location:** ${r.personal_info.location}\n\n`;
    md += `## PROFESSIONAL SUMMARY\n${r.professional_summary}\n\n`;
    md += `## SKILLS\n${r.skills.join(', ')}\n\n`;
    md += `## EXPERIENCE\n`;
    r.work_experience.forEach(exp => {
      md += `### ${exp.company}\n`;
      md += `**${exp.role}** | *${exp.location}* | *${exp.duration}*\n\n`;
      exp.bullet_points.forEach(b => {
        md += `* ${b}\n`;
      });
      md += `\n`;
    });
    md += `## EDUCATION\n`;
    r.education.forEach(e => {
      md += `* **${e.institution}** - *${e.degree}* (${e.graduation_year})\n`;
    });
    return md;
  };

  const downloadJsonFile = () => {
    if (!results) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resumebuilder_tailored_${results.tailored_resume.personal_info.name.replace(/\s+/g, '_')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadTextFile = () => {
    if (!results || !results.tailored_resume) return;
    const text = buildPlainText();
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `resumebuilder_tailored_${results.tailored_resume.personal_info.name.replace(/\s+/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const printDocument = () => {
    window.print();
  };

  // Helper trigger to rewrite a bullet point with AI instructions
  const handleAIRewriteBullet = async (expIndex, bulletIndex, currentText) => {
    const promptInput = prompt("Enter specific instructions for rewriting this bullet point (e.g. 'Emphasize visual hierarchy metrics' or 'Make it start with directed'):", "Make it start with a stronger action verb and add a quantified metric.");
    if (promptInput === null) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          rawResume: `Alex Rivera\nEXPERIENCE\n- ${currentText}`,
          jobDescription: jobDescription,
          userInstructions: `Rewrite only the single experience bullet point provided. Focus instruction: "${promptInput}". Return the output strictly in the schema. Make the tailored resume work experience have 1 company and 1 bullet point containing the rewritten text.`
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Rewriting failed.');

      const rewrittenText = data.tailored_resume?.work_experience?.[0]?.bullet_points?.[0];
      if (rewrittenText) {
        updateWorkBullet(expIndex, bulletIndex, rewrittenText);
      } else {
        alert("Could not extract rewritten bullet point from API output.");
      }
    } catch (err) {
      alert(`AI Rewrite Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen overflow-hidden bg-background text-on-surface">
      
      {/* SideNavBar Component */}
      <aside className="fixed left-0 top-0 h-full w-[280px] bg-surface-container-lowest dark:bg-surface-container-low shadow-sm flex flex-col py-stack-lg px-gutter border-r border-outline-variant/20 z-50">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center text-primary-fixed-dim shadow-sm">
              <span className="material-symbols-outlined text-white" data-icon="contact_page">contact_page</span>
            </div>
            <div>
              <h1 className="font-headline-md text-headline-md font-bold text-on-surface">RESUME BUILDER</h1>
            </div>
          </div>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 space-y-1">
          <button 
            onClick={() => { setCurrentScreen('ingestion'); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all ${currentScreen === 'ingestion' ? 'text-primary font-bold border-r-2 border-primary bg-surface-container-high' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
            <span>Dashboard</span>
          </button>
          
          <button 
            onClick={() => { if (results) setCurrentScreen('workspace'); }}
            disabled={!results}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-label-md text-label-md transition-all ${!results ? 'opacity-40 cursor-not-allowed' : ''} ${currentScreen === 'workspace' ? 'text-primary font-bold border-r-2 border-primary bg-surface-container-high' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
          >
            <span className="material-symbols-outlined" data-icon="description">description</span>
            <span>My Resumes</span>
          </button>
          
          <button 
            onClick={() => { 
              setCurrentScreen('ingestion');
              setTimeout(() => {
                const el = document.getElementById('recent-history');
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }, 100);
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-surface-container-high transition-colors text-left"
          >
            <span className="material-symbols-outlined" data-icon="history">history</span>
            <span>History</span>
          </button>
        </nav>

          {/* Action Button at bottom of Sidebar */}
          <div className="mt-auto pt-stack-lg border-t border-outline-variant/20">
            <button 
              onClick={() => { handleClear(); setCurrentScreen('ingestion'); }}
              className="w-full bg-primary py-3 px-4 rounded-lg text-on-primary font-label-md text-label-md flex items-center justify-center gap-2 hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="add">add</span>
              New Tailoring
            </button>
          </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-[280px] flex-1 flex flex-col h-screen relative bg-background overflow-hidden">
        
        {/* TOP NAVBAR */}
        <header className="sticky top-0 w-full z-45 flex justify-between items-center h-16 px-margin-page bg-surface-container-lowest/80 backdrop-blur-md border-b border-outline-variant/30">
          <div className="flex items-center gap-6">
            {results && currentScreen === 'workspace' && (
              <div className="flex items-center gap-2 px-3 py-1 bg-secondary-container text-on-secondary-container rounded-full animate-pulse-slow">
                <span className="material-symbols-outlined text-[18px]" data-icon="auto_awesome">auto_awesome</span>
                <span className="font-label-md text-label-md">Tailored Draft Ready</span>
              </div>
            )}
            <h2 className="font-headline-md text-headline-md font-bold text-on-surface">Tailoring Engine</h2>
            
            {results && currentScreen === 'workspace' && (
              <nav className="hidden md:flex gap-6 ml-4">
                <button 
                  onClick={() => setActiveNavTab('editor')}
                  className={`font-body-md text-body-md pb-1 ${activeNavTab === 'editor' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-primary transition-colors'}`}
                >
                  Editor
                </button>
                <button 
                  onClick={() => setActiveNavTab('analysis')}
                  className={`font-body-md text-body-md pb-1 ${activeNavTab === 'analysis' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-primary transition-colors'}`}
                >
                  Analysis
                </button>
                <button 
                  onClick={() => setActiveNavTab('json')}
                  className={`font-body-md text-body-md pb-1 ${activeNavTab === 'json' ? 'text-primary border-b-2 border-primary font-bold' : 'text-on-surface-variant hover:text-primary transition-colors'}`}
                >
                  JSON Payload
                </button>
              </nav>
            )}
          </div>
          
          {/* Topbar Action Buttons */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => copyToClipboard(buildPlainText(), 'Plain Text')}
              className="text-on-surface-variant hover:text-primary p-2 hover:bg-surface-container-high rounded-full transition-colors active:opacity-80" 
              title="Copy Plain Text"
            >
              <span className="material-symbols-outlined" data-icon="share">share</span>
            </button>
            <button 
              onClick={downloadTextFile}
              className="text-on-surface-variant hover:text-primary p-2 hover:bg-surface-container-high rounded-full transition-colors active:opacity-80" 
              title="Download Text Resume"
            >
              <span className="material-symbols-outlined" data-icon="download">download</span>
            </button>
            
            <div className="h-6 w-[1px] bg-outline-variant/30 mx-1"></div>
            
            <button 
              onClick={() => copyToClipboard(buildMarkdown(), 'Markdown')}
              className="font-label-md text-label-md border border-outline px-4 py-1.5 rounded hover:bg-surface-container-high transition-colors"
            >
              Copy Markdown
            </button>
            <button 
              onClick={printDocument}
              className="font-label-md text-label-md bg-primary text-on-primary px-4 py-1.5 rounded hover:opacity-90 transition-opacity active:scale-[0.98]"
            >
              Export PDF
            </button>
          </div>
        </header>

        {/* MAIN CANVAS */}
        <div className="flex-1 overflow-hidden flex flex-col">
          
          {/* ==================== SCREEN A: INGESTION SCREEN ==================== */}
          {currentScreen === 'ingestion' && (
            <div className="flex-1 overflow-y-auto p-margin-page custom-scrollbar">
              <div className="max-w-[1200px] mx-auto w-full">
                
                <div className="mb-stack-lg flex justify-between items-end">
                  <div>
                    <h3 className="font-headline-lg text-headline-lg text-on-surface">Ingestion &amp; Workspace</h3>
                    <p className="font-body-md text-body-md text-on-surface-variant">Provide your documents to begin the high-performance AI ATS matching process.</p>
                  </div>
                  <button 
                    onClick={loadSampleProject}
                    className="flex items-center gap-2 bg-surface-container-high text-primary border border-outline-variant/60 px-5 py-2 rounded-lg font-label-md hover:bg-surface-container-highest transition-colors active:scale-[0.98]"
                  >
                    <span className="material-symbols-outlined text-[18px]" data-icon="data_exploration">data_exploration</span>
                    Autofill Mock Job
                  </button>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-error-container/20 border border-error/20 rounded-xl text-error flex items-start gap-3">
                    <span className="material-symbols-outlined text-[22px]" data-icon="error">error</span>
                    <div className="font-body-sm text-body-sm">{error}</div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter items-stretch">
                  
                  {/* Left Ingestion Column: Resume Input */}
                  <div className="space-y-gutter flex flex-col">
                    <section className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant/20 flex-1 flex flex-col min-h-[500px]">
                      
                      <div className="mb-stack-md flex items-center justify-between">
                        <h4 className="font-headline-md text-headline-md font-bold">Resume Repository</h4>
                        <span className="material-symbols-outlined text-on-surface-variant/40" data-icon="cloud_upload">cloud_upload</span>
                      </div>
                      
                      {/* Drag & Drop Upload Zone or Text Editor */}
                      <div className="flex-grow flex flex-col space-y-4">
                        {!rawResume ? (
                          <div 
                            onClick={triggerFileSelect}
                            className="flex-grow border-2 border-dashed border-outline-variant rounded-xl p-stack-xl flex flex-col items-center justify-center text-center group hover:border-primary transition-all cursor-pointer bg-surface/50 min-h-[300px]"
                          >
                            <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-stack-md group-hover:scale-110 transition-transform shadow-sm">
                              <span className="material-symbols-outlined text-primary text-3xl" data-icon="description">description</span>
                            </div>
                            <p className="font-headline-md text-headline-md font-bold mb-2 text-on-surface">Upload Resume (PDF/DOCX/TXT)</p>
                            <p className="font-body-sm text-body-sm text-on-surface-variant mb-stack-md max-w-xs">AI will parse your content to identify key skills and experience markers.</p>
                            <button type="button" className="font-label-md text-label-md bg-primary text-on-primary px-6 py-2.5 rounded-lg hover:opacity-90 transition-opacity active:scale-[0.98]">Browse File</button>
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              onChange={handleFileChange} 
                              accept=".pdf,.docx,.txt" 
                              className="hidden" 
                            />
                          </div>
                        ) : (
                          <div className="flex-grow flex flex-col">
                            <div className="flex justify-between items-center mb-1.5">
                              <label className="block font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">
                                {activeFilename ? `Ingested Resume: ${activeFilename}` : "Resume Text Content"}
                              </label>
                              <button 
                                type="button" 
                                onClick={() => { setRawResume(''); setActiveFilename(''); }}
                                className="text-xs text-error font-bold hover:underline flex items-center gap-1"
                              >
                                <span className="material-symbols-outlined text-[14px]" data-icon="delete">delete</span>
                                Clear Resume
                              </button>
                            </div>

                            <div className={`mb-3 p-3 rounded-lg border flex items-center justify-between transition-colors ${currentScore ? 'bg-secondary/5 border-secondary/20' : 'bg-surface-container-high border-outline-variant/30'}`}>
                              <div className="flex items-center gap-2">
                                <span className={`material-symbols-outlined ${currentScore ? 'text-secondary' : 'text-on-surface-variant/60'}`} data-icon="analytics">analytics</span>
                                <span className={`text-xs font-bold ${currentScore ? 'text-on-surface' : 'text-on-surface-variant'}`}>ATS Compatibility Score:</span>
                              </div>
                              {currentScore ? (
                                <span className="text-xs font-extrabold text-secondary bg-white px-2 py-0.5 rounded shadow-sm border border-secondary/10 font-mono-sm">
                                  {currentScore}
                                </span>
                              ) : (
                                <span className="text-xs font-semibold text-on-surface-variant italic">
                                  Pending Analysis
                                </span>
                              )}
                            </div>

                            <textarea 
                              value={rawResume}
                              onChange={(e) => setRawResume(e.target.value)}
                              className="flex-grow w-full min-h-[260px] p-4 bg-surface-container-low border border-outline-variant/45 rounded-xl font-body-sm text-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all resize-none"
                              placeholder="Review resume text here..."
                            />
                            <input 
                              type="file" 
                              ref={fileInputRef} 
                              onChange={handleFileChange} 
                              accept=".pdf,.docx,.txt" 
                              className="hidden" 
                            />
                          </div>
                        )}
                      </div>

                      {/* Recently Uploaded List */}
                      <div id="recent-history" className="mt-stack-lg border-t border-outline-variant/20 pt-4">
                        <p className="font-label-md text-label-md text-on-surface-variant mb-2 uppercase tracking-wider font-bold">Recently Uploaded Resumes</p>
                        <div className="grid grid-cols-2 gap-3">
                          {recentResumes.map((item, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => { setRawResume(item.text); setActiveFilename(item.filename); }}
                              className="flex items-center gap-2.5 p-2.5 border border-outline-variant/30 rounded bg-surface hover:bg-surface-container-high transition-colors cursor-pointer text-left w-full"
                            >
                              <span className="material-symbols-outlined text-outline text-[20px]" data-icon="draft">draft</span>
                              <div className="truncate flex-1">
                                <p className="text-[11px] font-bold text-on-surface truncate leading-tight">{item.filename}</p>
                                <span className="text-[9px] text-outline uppercase font-mono-sm font-semibold font-bold">MATCHED {item.score}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                    </section>
                  </div>

                  {/* Right Ingestion Column: Target Context */}
                  <div className="space-y-gutter flex flex-col">
                    <section className="bg-surface-container-lowest p-stack-lg rounded-xl shadow-sm border border-outline-variant/20 flex-1 flex flex-col min-h-[500px]">
                      
                      <div className="mb-stack-md flex items-center justify-between">
                        <h4 className="font-headline-md text-headline-md font-bold">Target Context</h4>
                        <span className="material-symbols-outlined text-on-surface-variant/40" data-icon="target">target</span>
                      </div>

                      <div className="flex-1 flex flex-col space-y-4">
                        {/* Target Job Description */}
                        <div className="flex-1 flex flex-col">
                          <label className="block font-label-md text-label-md text-on-surface-variant mb-1 uppercase tracking-wider">Paste Job Description</label>
                          <textarea 
                            value={jobDescription}
                            onChange={(e) => setJobDescription(e.target.value)}
                            className="flex-grow w-full min-h-[220px] p-4 bg-surface-container-low border border-outline-variant/45 rounded-xl font-body-sm text-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all resize-none placeholder:text-outline-variant"
                            placeholder="Paste target job descriptions, roles, key requirements, and hard skills keywords..."
                          />
                        </div>

                        {/* Special instructions */}
                        <div className="relative">
                          <label className="block font-label-md text-label-md text-on-surface-variant mb-1.5 uppercase tracking-wider">Special AI Instructions (Optional)</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-on-surface-variant/40 text-[20px]" data-icon="auto_awesome">auto_awesome</span>
                            <input 
                              type="text" 
                              value={userInstructions}
                              onChange={(e) => setUserInstructions(e.target.value)}
                              className="w-full pl-10 pr-4 py-3 bg-surface-container-low border border-outline-variant/40 rounded-lg font-body-sm text-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline-variant" 
                              placeholder="e.g., Focus on my leadership roles or emphasize cloud certifications..."
                            />
                          </div>
                        </div>
                      </div>

                    </section>
                  </div>

                </div>

                {/* Submit Action Button Block */}
                <div className="mt-10 mb-10 flex flex-col items-center">
                  <button 
                    onClick={() => handleAnalyze()}
                    disabled={isLoading}
                    className="group relative bg-primary text-on-primary px-12 py-5 rounded-full shadow-lg hover:shadow-xl hover:translate-y-[-2px] transition-all active:scale-[0.98] active:translate-y-0 overflow-hidden disabled:opacity-85 disabled:cursor-not-allowed"
                  >
                    <span className="relative z-10 font-headline-md text-headline-md flex items-center gap-4">
                      {isLoading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin" data-icon="sync">sync</span> 
                          Processing Vectors...
                        </>
                      ) : (
                        <>
                          Analyze &amp; Match Resume
                          <span className="material-symbols-outlined animate-pulse" data-icon="analytics">analytics</span>
                        </>
                      )}
                    </span>
                    <div className="absolute inset-0 bg-gradient-to-r from-primary via-on-primary-container/20 to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-700 blur-xl"></div>
                  </button>

                </div>

                {/* ATS Score & Match Overview Section */}
                {results && (
                  <div className="mt-8 p-stack-lg bg-surface-container-lowest border border-outline-variant/35 rounded-2xl shadow-sm text-left animate-pulse-slow">
                    <div className="flex justify-between items-center mb-6 pb-3 border-b border-outline-variant/30">
                      <div>
                        <h4 className="font-headline-md text-headline-md font-bold text-primary">Resume ATS Performance Summary</h4>
                        <p className="text-body-sm text-on-surface-variant">Instant compatibility rating and key recommendations.</p>
                      </div>
                      <button 
                        type="button"
                        onClick={() => setCurrentScreen('workspace')}
                        className="bg-primary text-on-primary px-6 py-2.5 rounded-lg text-body-sm font-label-md hover:opacity-90 active:scale-[0.98] transition-all flex items-center gap-2"
                      >
                        <span className="material-symbols-outlined text-[18px]" data-icon="open_in_new">open_in_new</span>
                        Open Interactive Workspace
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                      
                      {/* Match Score Circle Gauge */}
                      <div className="p-5 bg-surface-container-low rounded-xl border border-secondary/15 flex items-center justify-between shadow-sm">
                        <div>
                          <p className="font-headline-md text-3xl font-extrabold text-on-surface leading-none">{results.analysis.overall_compatibility_score}%</p>
                          <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider mt-1.5 font-bold">Compatibility Match</p>
                        </div>
                        <div className="w-14 h-14 rounded-full border-[4px] border-secondary border-t-transparent animate-spin-slow"></div>
                      </div>

                      {/* Score Breakdown Sliders */}
                      <div className="space-y-3 bg-surface-container-low p-4 rounded-xl border border-outline-variant/20">
                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-on-surface-variant mb-1">
                            <span>Keyword Correlation</span>
                            <span>{results.analysis.score_breakdown.keyword_match_score}%</span>
                          </div>
                          <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full" style={{ width: `${results.analysis.score_breakdown.keyword_match_score}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] font-bold text-on-surface-variant mb-1">
                            <span>STAR / Impact Verbs</span>
                            <span>{results.analysis.score_breakdown.impact_and_verbs_score}%</span>
                          </div>
                          <div className="h-2 w-full bg-surface-container-high rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${results.analysis.score_breakdown.impact_and_verbs_score}%` }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Quick Summary Feedback and Gaps */}
                      <div className="space-y-2.5 bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 h-full flex flex-col justify-center">
                        <div className="flex items-center gap-2 text-xs font-bold text-on-surface">
                          <span className="material-symbols-outlined text-secondary text-[18px]" data-icon="check_circle">check_circle</span>
                          <span>{results.analysis.keywords.matched_keywords.length} Core Keywords Matched</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-error font-semibold leading-relaxed">
                          <span className="material-symbols-outlined text-error text-[18px] flex-shrink-0" data-icon="warning">warning</span>
                          <span>{results.analysis.critical_gaps.length > 0 ? results.analysis.critical_gaps[0] : "No critical experience gaps detected."}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* ==================== SCREEN B: WORKSPACE STATE ==================== */}
          {currentScreen === 'workspace' && results && (
            <div className="flex-grow flex overflow-hidden">
              
              {/* Left Column: Reference Area */}
              <section className="w-[400px] border-r border-outline-variant/30 bg-surface-container-lowest flex flex-col overflow-hidden">
                <div className="p-gutter overflow-y-auto custom-scrollbar space-y-6 flex-grow">
                  
                  {/* Job Description Panel */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Target Job Description</h3>
                      <span className="text-primary font-mono-sm text-mono-sm bg-primary-fixed px-2 py-0.5 rounded">Target Role</span>
                    </div>
                    <div className="p-4 bg-surface rounded-xl border border-outline-variant/20 text-body-sm font-body-sm text-on-surface-variant leading-relaxed max-h-[180px] overflow-y-auto custom-scrollbar">
                      {jobDescription}
                    </div>
                  </div>

                  {/* Left Panel conditional: Tab is EDITOR -> shows keywords checklist */}
                  {activeNavTab === 'editor' && (
                    <div className="space-y-4">
                      <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Keywords Checklist (AI Scan)</h3>
                      <div className="space-y-2">
                        
                        {/* Missing Keywords list */}
                        {results.analysis.keywords.missing_high_priority_keywords.slice(0, 3).map((kw, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-error-container/20 rounded-lg border border-error/10">
                            <span className="font-body-sm text-on-surface font-semibold text-xs">{kw}</span>
                            <span className="bg-error text-on-error font-mono-sm px-2 py-0.5 rounded-full text-[9px] font-bold">MISSING</span>
                          </div>
                        ))}
                        
                        {/* Missing Low priority keywords */}
                        {results.analysis.keywords.missing_low_priority_keywords.slice(0, 2).map((kw, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <span className="font-body-sm text-on-surface text-xs">{kw}</span>
                            <span className="bg-amber-600 text-white font-mono-sm px-2 py-0.5 rounded-full text-[9px] font-bold">MISSING</span>
                          </div>
                        ))}

                        {/* Matched Keywords list */}
                        {results.analysis.keywords.matched_keywords.slice(0, 4).map((kw, idx) => (
                          <div key={idx} className="flex items-center justify-between p-3 bg-surface-container-high rounded-lg border border-outline-variant/20 opacity-70">
                            <span className="font-body-sm text-on-surface-variant text-xs">{kw}</span>
                            <span className="material-symbols-outlined text-secondary text-[18px]" data-icon="check_circle">check_circle</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Left Panel conditional: Tab is ANALYSIS -> shows detailed scores breakdown */}
                  {activeNavTab === 'analysis' && (
                    <div className="space-y-6">
                      
                      {/* Breakdown Scores */}
                      <div className="space-y-4">
                        <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Breakdown Analytics</h3>
                        
                        {/* Keyword correlation progress bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-on-surface-variant">Keyword Match Score</span>
                            <span className="font-bold text-primary">{results.analysis.score_breakdown.keyword_match_score}%</span>
                          </div>
                          <div className="h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                            <div className="h-full bg-secondary rounded-full" style={{ width: `${results.analysis.score_breakdown.keyword_match_score}%` }}></div>
                          </div>
                        </div>

                        {/* Impact and verbs progress bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-on-surface-variant">Impact & STAR Verbs</span>
                            <span className="font-bold text-primary">{results.analysis.score_breakdown.impact_and_verbs_score}%</span>
                          </div>
                          <div className="h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${results.analysis.score_breakdown.impact_and_verbs_score}%` }}></div>
                          </div>
                        </div>

                        {/* Formatting progress bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-on-surface-variant">Formatting Parsing Safety</span>
                            <span className="font-bold text-primary">{results.analysis.score_breakdown.formatting_score}%</span>
                          </div>
                          <div className="h-2.5 w-full bg-surface-container-high rounded-full overflow-hidden">
                            <div className="h-full bg-cyan-600 rounded-full" style={{ width: `${results.analysis.score_breakdown.formatting_score}%` }}></div>
                          </div>
                        </div>
                      </div>

                      {/* Gaps alert list */}
                      <div className="space-y-2">
                        <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Qualification Gaps</h3>
                        <div className="space-y-2">
                          {results.analysis.critical_gaps.map((gap, i) => (
                            <div key={i} className="p-3 bg-error-container/20 text-error border border-error/15 rounded-lg text-xs leading-relaxed">
                              • {gap}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Formatting suggestions */}
                      <div className="space-y-2">
                        <h3 className="font-label-md text-label-md uppercase tracking-wider text-on-surface-variant">Formatting Insights</h3>
                        <div className="space-y-2">
                          {results.analysis.formatting_feedback.map((fb, i) => (
                            <div key={i} className="p-3 bg-surface-container-high text-on-surface border border-outline-variant/30 rounded-lg text-xs leading-relaxed">
                              {fb}
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  {/* Left Column: Match Score Gauge */}
                  <div className="p-5 bg-surface-container-low rounded-2xl flex items-center justify-between border border-secondary/10 mt-auto shadow-sm">
                    <div>
                      <p className="font-headline-md text-headline-md text-on-surface font-extrabold text-2xl">{results.analysis.overall_compatibility_score}%</p>
                      <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-wider">Match Score</p>
                    </div>
                    <div className="w-12 h-12 rounded-full border-[3px] border-secondary border-t-transparent animate-spin-slow"></div>
                  </div>

                </div>
              </section>

              {/* Right Column: Interactive Editor / Preview Panel */}
              <section className="flex-1 bg-surface-container-low flex justify-center overflow-y-auto custom-scrollbar py-stack-xl px-4">
                
                {/* A. EDITOR TAB VIEW */}
                {activeNavTab === 'editor' && (
                  <div className="w-[800px] min-h-[1050px] bg-white paper-shadow p-20 flex flex-col gap-10 relative text-left">
                    
                    {/* Resume Header */}
                    <header className="border-b border-outline-variant/30 pb-stack-lg flex justify-between items-start">
                      <div className="flex-grow pr-4">
                        <h1 
                          contentEditable 
                          suppressContentEditableWarning
                          onBlur={(e) => updatePersonalInfo('name', e.target.textContent)}
                          className="font-headline-lg text-headline-lg text-primary tracking-tight uppercase outline-none focus:bg-surface-container-low transition-colors px-1"
                        >
                          {results.tailored_resume.personal_info.name}
                        </h1>
                        <p className="font-body-md text-body-md text-on-surface-variant flex gap-2 flex-wrap items-center mt-1">
                          <span contentEditable suppressContentEditableWarning className="outline-none focus:bg-surface-container-low transition-colors px-1">
                            {results.tailored_resume.personal_info.email}
                          </span>
                          <span>•</span>
                          <span contentEditable suppressContentEditableWarning onBlur={(e) => updatePersonalInfo('phone', e.target.textContent)} className="outline-none focus:bg-surface-container-low transition-colors px-1">
                            {results.tailored_resume.personal_info.phone}
                          </span>
                          {results.tailored_resume.personal_info.linkedin && (
                            <>
                              <span>•</span>
                              <span contentEditable suppressContentEditableWarning onBlur={(e) => updatePersonalInfo('linkedin', e.target.textContent)} className="outline-none focus:bg-surface-container-low transition-colors px-1 text-primary hover:underline">
                                {results.tailored_resume.personal_info.linkedin}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="text-right font-body-sm text-body-sm text-on-surface-variant">
                        <span contentEditable suppressContentEditableWarning onBlur={(e) => updatePersonalInfo('location', e.target.textContent)} className="outline-none focus:bg-surface-container-low transition-colors px-1">
                          {results.tailored_resume.personal_info.location}
                        </span>
                      </div>
                    </header>

                    {/* Professional Summary Section */}
                    <section className="group editing-line relative">
                      <h2 className="font-label-md text-label-md text-primary mb-stack-sm tracking-widest uppercase font-bold">Professional Summary</h2>
                      <div 
                        contentEditable 
                        suppressContentEditableWarning
                        onBlur={(e) => updateSummary(e.target.textContent)}
                        className="outline-none focus:bg-surface-container-low transition-colors p-2 font-body-md text-body-md text-on-surface leading-relaxed border border-transparent rounded hover:border-outline-variant/30"
                      >
                        {results.tailored_resume.professional_summary}
                      </div>

                      {/* AI Hover Toolbar for Professional Summary */}
                      <div className="ai-pill absolute -right-48 top-0 flex flex-col gap-2 p-2 bg-white shadow-xl rounded-xl border border-outline-variant/30 z-10 w-44">
                        <button 
                          onClick={async () => {
                            const newInstructions = prompt("Rewrite instructions for Professional Summary:", "Make it sound more executive and highlight strategic planning.");
                            if (newInstructions) {
                              setIsLoading(true);
                              try {
                                const response = await fetch('/api/analyze', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json'
                                  },
                                  body: JSON.stringify({
                                    rawResume: `Alex Rivera\n${results.tailored_resume.professional_summary}`,
                                    jobDescription: jobDescription,
                                    userInstructions: `Rewrite only the professional summary text. Instruction: "${newInstructions}". Return in standard schema.`
                                  })
                                });
                                const data = await response.json();
                                if (data.tailored_resume?.professional_summary) updateSummary(data.tailored_resume.professional_summary);
                              } catch (e) {
                                alert("Failed to rewrite professional summary");
                              } finally {
                                setIsLoading(false);
                              }
                            }
                          }}
                          className="flex items-center gap-2 text-primary hover:bg-surface-container-low p-2 rounded text-left transition-colors"
                        >
                          <span className="material-symbols-outlined text-[16px] text-primary" data-icon="auto_fix_high">auto_fix_high</span>
                          <span className="font-label-md text-[10px] font-bold">Rewrite with AI</span>
                        </button>
                      </div>
                    </section>

                    {/* Technical Skills Section */}
                    <section className="editing-line relative">
                      <h2 className="font-label-md text-label-md text-primary mb-stack-sm tracking-widest uppercase font-bold">Skills</h2>
                      <div className="p-2 border border-transparent rounded">
                        <p className="font-body-md text-body-md text-on-surface">
                          <strong>Skills &amp; Frameworks: </strong>
                          <span 
                            contentEditable 
                            suppressContentEditableWarning
                            onBlur={(e) => {
                              const list = e.target.textContent.split(',').map(s => s.trim());
                              setResults({
                                ...results,
                                tailored_resume: {
                                  ...results.tailored_resume,
                                  skills: list
                                }
                              });
                            }}
                            className="outline-none focus:bg-surface-container-low px-1 py-0.5"
                          >
                            {results.tailored_resume.skills.join(', ')}
                          </span>
                        </p>
                      </div>
                    </section>

                    {/* Professional Work Experience */}
                    <section className="space-y-6">
                      <h2 className="font-label-md text-label-md text-primary mb-stack-sm tracking-widest uppercase border-b border-outline-variant/20 pb-2 font-bold">Experience</h2>
                      
                      {results.tailored_resume.work_experience.map((exp, expIdx) => (
                        <div key={expIdx} className="space-y-2">
                          
                          {/* Experience Header */}
                          <div className="flex justify-between items-baseline">
                            <div className="flex gap-2 items-baseline">
                              <span 
                                contentEditable 
                                suppressContentEditableWarning
                                onBlur={(e) => updateWorkExp(expIdx, 'company', e.target.textContent)}
                                className="font-bold font-headline-md text-headline-md text-primary outline-none focus:bg-surface-container-low px-0.5"
                              >
                                {exp.company}
                              </span>
                              <span className="text-on-surface-variant font-body-sm">•</span>
                              <span 
                                contentEditable 
                                suppressContentEditableWarning
                                onBlur={(e) => updateWorkExp(expIdx, 'role', e.target.textContent)}
                                className="font-semibold text-body-md text-on-surface outline-none focus:bg-surface-container-low px-0.5 italic"
                              >
                                {exp.role}
                              </span>
                            </div>
                            <span 
                              contentEditable 
                              suppressContentEditableWarning
                              onBlur={(e) => updateWorkExp(expIdx, 'duration', e.target.textContent)}
                              className="font-body-sm text-body-sm text-on-surface-variant outline-none focus:bg-surface-container-low px-0.5"
                            >
                              {exp.duration}
                            </span>
                          </div>
                          
                          <div className="text-xs text-on-surface-variant -mt-1 font-body-sm mb-2">
                            <span contentEditable suppressContentEditableWarning onBlur={(e) => updateWorkExp(expIdx, 'location', e.target.textContent)} className="outline-none focus:bg-surface-container-low px-0.5">
                              {exp.location}
                            </span>
                          </div>

                          {/* Bullet Points */}
                          <ul className="list-disc pl-5 space-y-2 font-body-md text-body-md text-on-surface">
                            {exp.bullet_points.map((bullet, bIdx) => (
                              <li key={bIdx} className="editing-line group relative pl-1">
                                <div 
                                  contentEditable 
                                  suppressContentEditableWarning
                                  onBlur={(e) => updateWorkBullet(expIdx, bIdx, e.target.textContent)}
                                  className="outline-none focus:bg-surface-container-low px-1 py-0.5 rounded"
                                >
                                  {bullet}
                                </div>
                                
                                {/* Contextual AI Refinement Button */}
                                <button 
                                  onClick={() => handleAIRewriteBullet(expIdx, bIdx, bullet)}
                                  className="ai-pill absolute -left-10 top-0.5 text-primary-container bg-primary-fixed p-1 rounded-full hover:scale-110 transition-transform shadow-md"
                                  title="Refine Bullet with AI"
                                >
                                  <span className="material-symbols-outlined text-[16px] text-primary" data-icon="psychology">psychology</span>
                                </button>
                              </li>
                            ))}
                          </ul>

                        </div>
                      ))}
                    </section>

                    {/* Education Section */}
                    <section className="space-y-4">
                      <h2 className="font-label-md text-label-md text-primary mb-stack-sm tracking-widest uppercase border-b border-outline-variant/20 pb-2 font-bold">Education</h2>
                      {results.tailored_resume.education.map((edu, idx) => (
                        <div key={idx} className="flex justify-between items-baseline font-body-md text-body-md text-on-surface">
                          <div>
                            <strong className="text-primary">{edu.institution}</strong> — {edu.degree}
                          </div>
                          <span className="text-body-sm text-on-surface-variant font-semibold">{edu.graduation_year}</span>
                        </div>
                      ))}
                    </section>

                    {/* Certifications Section */}
                    {results.tailored_resume.certifications && results.tailored_resume.certifications.length > 0 && (
                      <section className="space-y-2">
                        <h2 className="font-label-md text-label-md text-primary mb-stack-sm tracking-widest uppercase border-b border-outline-variant/20 pb-2 font-bold">Certifications</h2>
                        <ul className="list-disc pl-5 font-body-md text-body-md text-on-surface space-y-1">
                          {results.tailored_resume.certifications.map((cert, idx) => (
                            <li key={idx} className="outline-none px-1">{cert}</li>
                          ))}
                        </ul>
                      </section>
                    )}

                    {/* Decorative Background mockup texture */}
                    <div className="absolute inset-0 -z-10 pointer-events-none opacity-5">
                      <img className="w-full h-full object-cover" data-alt="A clean high-contrast overhead workspace desk paper texture." src="https://lh3.googleusercontent.com/aida-public/AB6AXuDFS2GBtZhcrBlUdcSy3CV9HdZlCnV_DAQdCj6D0XCMuTEUlA384ZEoSGmNHE3q7FAXCByl6pcoUGgq1cdGxxynY33YUclQ2H0qLHEr0v5TOKuOlUnIlrM62OaGzhoERrDoqLsZBV_btgsWd_sVlYM9FPriZM0DMwwOYlY-I8EJRXG8GIgFTt5vQmECzmlA6NgqBKaSi6MQ8xOsCflowCMTv-AfWt80KmJvFWOg-Qi1uBL6LTD2-n-hROW82IDuD-uhbrxCrgQRbgm5"/>
                    </div>
                  </div>
                )}

                {/* B. ANALYSIS TAB VIEW (Highlights matched skills in yellow) */}
                {activeNavTab === 'analysis' && (
                  <div className="w-[800px] min-h-[1050px] bg-white paper-shadow p-20 flex flex-col gap-10 text-left">
                    <header className="border-b border-outline-variant/30 pb-stack-lg">
                      <h2 className="font-headline-lg text-headline-lg text-primary">{results.tailored_resume.personal_info.name}</h2>
                      <p className="text-on-surface-variant font-body-sm mt-1">{results.tailored_resume.personal_info.email} | {results.tailored_resume.personal_info.phone} | {results.tailored_resume.personal_info.location}</p>
                    </header>

                    {/* Summary */}
                    <section>
                      <h3 className="font-label-md text-label-md text-primary mb-2 tracking-widest uppercase font-bold">Summary Alignment</h3>
                      <p className="font-body-md text-body-md text-on-surface leading-relaxed">
                        {/* Highlight key keywords if they match JD keywords */}
                        {results.tailored_resume.professional_summary.split(' ').map((word, i) => {
                          const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
                          const isMatchedKeyword = results.analysis.keywords.matched_keywords.some(kw => kw.toLowerCase().includes(cleanWord) && cleanWord.length > 3);
                          return (
                            <span key={i} className={isMatchedKeyword ? "highlight-yellow px-0.5 rounded" : ""}>
                              {word}{' '}
                            </span>
                          );
                        })}
                      </p>
                    </section>

                    {/* Skills list */}
                    <section>
                      <h3 className="font-label-md text-label-md text-primary mb-2 tracking-widest uppercase font-bold">Skills Match Profile</h3>
                      <div className="flex flex-wrap gap-2">
                        {results.tailored_resume.skills.map((skill, idx) => {
                          const isMatched = results.analysis.keywords.matched_keywords.some(m => m.toLowerCase().includes(skill.toLowerCase()));
                          return (
                            <span key={idx} className={`px-3 py-1 rounded text-xs font-semibold ${isMatched ? 'bg-secondary/10 text-secondary border border-secondary/20' : 'bg-surface-container-high text-on-surface-variant'}`}>
                              {skill}
                            </span>
                          );
                        })}
                      </div>
                    </section>

                    {/* Work Experience with highlight markers */}
                    <section className="space-y-6">
                      <h3 className="font-label-md text-label-md text-primary mb-2 tracking-widest uppercase border-b border-outline-variant/20 pb-2 font-bold">Work Accomplishment Audit</h3>
                      {results.tailored_resume.work_experience.map((exp, expIdx) => (
                        <div key={expIdx} className="space-y-2">
                          <div className="flex justify-between font-bold text-body-md text-primary">
                            <span>{exp.company} — {exp.role}</span>
                            <span className="text-body-sm text-on-surface-variant">{exp.duration}</span>
                          </div>
                          
                          <ul className="list-disc pl-5 space-y-2 font-body-md text-body-md text-on-surface">
                            {exp.bullet_points.map((bullet, bIdx) => {
                              // Identify if bullet point contains numbers/metrics
                              const hasMetric = /\b\d+(?:%|\s|\b)/.test(bullet);
                              return (
                                <li key={bIdx} className="leading-relaxed">
                                  {bullet.split(' ').map((word, wIdx) => {
                                    const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"").toLowerCase();
                                    const isMatchedKeyword = results.analysis.keywords.matched_keywords.some(kw => kw.toLowerCase().includes(cleanWord) && cleanWord.length > 3);
                                    return (
                                      <span key={wIdx} className={isMatchedKeyword ? "highlight-yellow px-0.5 rounded" : ""}>
                                        {word}{' '}
                                      </span>
                                    );
                                  })}
                                  {hasMetric && (
                                    <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] bg-secondary-container text-on-secondary-container px-1.5 py-0.5 rounded font-mono font-bold">
                                      <span className="material-symbols-outlined text-[10px]" data-icon="percent">percent</span>
                                      STAR Metric Match
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                    </section>

                    <section className="mt-4 p-4 bg-surface rounded-xl border border-outline-variant/30 text-xs text-on-surface-variant flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-secondary text-[20px]" data-icon="info">info</span>
                      <p>
                        The yellow marks denote semantically identified keywords matching your target job requirements. The green badges indicate accomplishments with successfully quantified metrics aligned with the STAR and X-Y-Z frameworks.
                      </p>
                    </section>
                  </div>
                )}

                {/* C. RAW JSON VIEW */}
                {activeNavTab === 'json' && (
                  <div className="w-[800px] min-h-[500px] bg-primary-container p-6 rounded-xl border border-outline-variant/20 text-left">
                    <div className="flex justify-between items-center mb-4 pb-2 border-b border-outline-variant/20">
                      <span className="text-white text-xs font-mono">raw_response.json</span>
                      <div className="flex gap-4">
                        <button 
                          onClick={() => copyToClipboard(JSON.stringify(results, null, 2), 'JSON')}
                          className="text-primary-fixed-dim hover:text-white text-xs flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]" data-icon="content_copy">content_copy</span>
                          Copy Code
                        </button>
                        <button 
                          onClick={downloadJsonFile}
                          className="text-primary-fixed-dim hover:text-white text-xs flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]" data-icon="download">download</span>
                          Download JSON
                        </button>
                      </div>
                    </div>
                    <pre className="text-secondary-fixed text-xs overflow-x-auto custom-scrollbar font-mono max-h-[700px] whitespace-pre-wrap">
                      {JSON.stringify(results, null, 2)}
                    </pre>
                  </div>
                )}

              </section>

            </div>
          )}

        </div>

        {/* FEEDBACK & HELP TOAST (Floating suggestion toaster) */}
        {showToast && results && (
          <div className="absolute bottom-8 right-8 flex flex-col gap-4 z-50 no-print">
            <div className="bg-primary-container text-on-primary-fixed border border-outline-variant/20 p-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-sm">
              <div className="w-10 h-10 rounded-full bg-secondary-fixed-dim flex items-center justify-center text-primary-container flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-[20px]" data-icon="lightbulb" style={{ fontVariationSettings: "'FILL' 1" }}>lightbulb</span>
              </div>
              <div className="text-left">
                <p className="font-label-md text-label-md text-white font-bold">AI Suggestion</p>
                <p className="font-body-sm text-body-sm text-on-primary-container leading-snug">{toastMessage}</p>
              </div>
              <button onClick={() => setShowToast(false)} className="text-white/40 hover:text-white transition-colors flex-shrink-0 self-start">
                <span className="material-symbols-outlined text-[18px]" data-icon="close">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Background decorative vector blurs */}
        <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
        <div className="absolute bottom-1/4 -left-20 w-96 h-96 bg-secondary/5 rounded-full blur-[120px] -z-10 pointer-events-none"></div>

      </main>
    </div>
  );
}
