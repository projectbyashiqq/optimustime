import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { KnowledgeItem } from '../types';
import { 
  BookOpen, 
  Plus, 
  Search, 
  Tag, 
  Link as LinkIcon, 
  Trash2, 
  Edit3, 
  ExternalLink,
  Sparkles,
  FileText,
  Check
} from 'lucide-react';

export const KnowledgeHubView: React.FC = () => {
  const { knowledge, categories, addKnowledgeItem, updateKnowledgeItem, deleteKnowledgeItem, searchQuery } = useApp();
  
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeItem, setActiveItem] = useState<KnowledgeItem | null>(knowledge[0] || null);
  const [isCreating, setIsCreating] = useState(false);

  // New item form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]?.name || 'OptimusLAB');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [linkInput, setLinkInput] = useState('');

  const filteredItems = knowledge.filter(item => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchContent = item.content.toLowerCase().includes(q);
      const matchTags = item.tags.some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchContent && !matchTags) return false;
    }
    return true;
  });

  const handleSaveNew = () => {
    if (!title.trim()) return;
    const tags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);
    const links = linkInput ? [linkInput.trim()] : [];

    addKnowledgeItem({
      title: title.trim(),
      category,
      content,
      tags,
      links
    });

    setTitle('');
    setContent('');
    setTagsInput('');
    setLinkInput('');
    setIsCreating(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top Banner */}
      <div className="glass-panel p-6 rounded-2xl border border-theme-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-500 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-black text-theme-text tracking-tight">
              Unified Knowledge & Notes Architecture
            </h2>
            <p className="text-xs text-theme-muted mt-0.5">
              Centralized repository for technical specs, ideas, documentation links, and knowledge items.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setIsCreating(true);
            setActiveItem(null);
          }}
          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Knowledge Note</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: List & Category Filter */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
              }`}
            >
              All
            </button>
            {categories.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.name)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                  selectedCategory === c.name
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-theme-card text-theme-muted hover:bg-theme-card-hover border border-theme-border'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filteredItems.length === 0 ? (
              <div className="p-8 text-center text-xs text-theme-muted glass-panel rounded-2xl">
                No notes found.
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = activeItem?.id === item.id && !isCreating;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setActiveItem(item);
                      setIsCreating(false);
                    }}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-2 ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-md ring-1 ring-blue-500/20'
                        : 'bg-theme-card border-theme-border hover:bg-theme-card-hover'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-theme-card-hover border border-theme-border text-theme-muted">
                        {item.category}
                      </span>
                      <span className="text-[10px] font-mono text-theme-muted">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-theme-text line-clamp-1">
                      {item.title}
                    </h4>

                    <p className="text-xs text-theme-muted line-clamp-2 leading-relaxed">
                      {item.content}
                    </p>

                    {item.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        {item.tags.map((tag, idx) => (
                          <span key={idx} className="text-[10px] font-semibold text-theme-muted bg-theme-card-hover px-2 py-0.5 rounded">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Note Reader / Editor */}
        <div className="lg:col-span-2">
          {isCreating ? (
            <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4 animate-fade-in">
              <h3 className="text-sm font-bold text-theme-text uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-500" />
                Create New Knowledge Note
              </h3>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-theme-muted block mb-1">Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Memory Layout & Event Engine Architecture..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full text-sm px-3.5 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-theme-muted block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-theme-muted block mb-1">Content (Markdown supported)</label>
                  <textarea
                    rows={8}
                    placeholder="Write detailed documentation, findings, formulas or rules..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-theme-muted block mb-1">Tags (comma separated)</label>
                    <input
                      type="text"
                      placeholder="Architecture, API, Rules"
                      value={tagsInput}
                      onChange={(e) => setTagsInput(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-theme-muted block mb-1">Reference URL</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-xl bg-theme-card-hover border border-theme-border text-theme-text focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsCreating(false)}
                    className="px-4 py-2 text-xs font-semibold text-theme-muted hover:text-theme-text"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNew}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md"
                  >
                    Save Note
                  </button>
                </div>
              </div>
            </div>
          ) : activeItem ? (
            <div className="glass-panel p-6 rounded-2xl border border-theme-border space-y-4 animate-fade-in">
              <div className="flex items-start justify-between gap-4 border-b border-theme-border pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                      {activeItem.category}
                    </span>
                    <span className="text-xs text-theme-muted font-mono">
                      Updated {new Date(activeItem.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-theme-text mt-2">
                    {activeItem.title}
                  </h3>
                </div>

                <button
                  onClick={() => deleteKnowledgeItem(activeItem.id)}
                  className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-theme-muted hover:text-red-500 transition-colors"
                  title="Delete Note"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Note Content */}
              <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed text-theme-text whitespace-pre-wrap font-mono bg-theme-card-hover p-4 rounded-xl border border-theme-border">
                {activeItem.content}
              </div>

              {/* Tags & Links */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-theme-border">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeItem.tags.map((tag, idx) => (
                    <span key={idx} className="text-xs font-semibold text-theme-muted bg-theme-card-hover px-2.5 py-1 rounded-lg border border-theme-border">
                      #{tag}
                    </span>
                  ))}
                </div>

                {activeItem.links.map((lnk, idx) => (
                  <a
                    key={idx}
                    href={lnk}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View Reference Link</span>
                  </a>
                ))}
              </div>

            </div>
          ) : (
            <div className="glass-panel p-12 rounded-2xl text-center text-xs text-theme-muted">
              Select or create a knowledge item to read.
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
