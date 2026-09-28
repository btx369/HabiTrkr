import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Tag, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useToastSettings } from '@/contexts/ToastContext';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { getAllTagsWithCounts, renameTagGlobally, deleteTagGlobally } from '@/lib/tagStorage';
import blurredBackground from '@/assets/blurred_background.png';

interface TagWithCount {
  tag: string;
  count: number;
}

export default function TagsManager() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToastSettings();
  const { theme } = useTheme();

  // This page renders its own full-height container instead of using <Layout>, so it
  // has to pick the background itself. The blurred artwork is a LIGHT-mode asset; in
  // dark mode it left a bright image sitting under dark surfaces, which no other page
  // does. Keep the image for light mode only and fall back to the themed surface.
  const isDark = theme === 'dark';

  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [deletingTag, setDeletingTag] = useState<TagWithCount | null>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load all tags on mount
  useEffect(() => {
    loadTags();
  }, []);

  const loadTags = () => {
    const tagsWithCounts = getAllTagsWithCounts();
    setAllTags(tagsWithCounts);
  };

  const filteredTags = allTags.filter(({ tag }) =>
    tag.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEditClick = (tag: string) => {
    setEditingTag(tag);
    setNewTagName(tag);
    setShowRenameDialog(true);
  };

  const handleDeleteClick = (tagData: TagWithCount) => {
    setDeletingTag(tagData);
    setShowDeleteConfirm(true);
  };

  const handleRenameConfirm = () => {
    if (!editingTag || !newTagName.trim()) return;

    const trimmedName = newTagName.trim().toLowerCase();

    // Validation
    if (trimmedName === editingTag) {
      setShowRenameDialog(false);
      return;
    }

    if (trimmedName.length > 30) {
      toast.error(t('tagNameTooLong'));
      return;
    }

    if (allTags.some(t => t.tag.toLowerCase() === trimmedName && t.tag !== editingTag)) {
      toast.error(t('tagAlreadyExists'));
      return;
    }

    // Perform rename
    renameTagGlobally(editingTag, trimmedName);
    loadTags();
    setShowRenameDialog(false);
    setEditingTag(null);
    setNewTagName('');
    toast.success(t('tagRenamed'));
  };

  const handleDeleteConfirm = () => {
    if (!deletingTag) return;

    deleteTagGlobally(deletingTag.tag);
    loadTags();
    setShowDeleteConfirm(false);
    setDeletingTag(null);
    toast.success(t('tagDeleted'));
  };

  return (
    <div 
      className={`min-h-screen ${isDark ? 'bg-background' : 'bg-cover bg-center bg-fixed'}`}
      style={isDark ? undefined : { backgroundImage: `url(${blurredBackground})` }}
    >
      {/* Header */}
      <div className="px-4 py-4">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="text-foreground hover:bg-black hover:text-white rounded-full [&_svg]:!size-6"
          >
            <ChevronLeft size={24} />
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{t('manageTags')}</h1>
          <div className="w-10" />
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-8 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            placeholder={t('searchTags')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-[hsl(var(--glass-bg))] backdrop-blur-xl border-[hsl(var(--glass-border))] rounded-full"
          />
        </div>

        {/* Tag Count */}
        <div className="text-sm text-muted-foreground px-2">
          {t('totalTags')}: {allTags.length}
        </div>

        {/* Tags List */}
        {filteredTags.length > 0 ? (
          <div className="bg-[hsl(var(--glass-bg))] backdrop-blur-xl border border-[hsl(var(--glass-border))] rounded-[20px] overflow-hidden">
            {filteredTags.map((tagData, index) => (
              <div key={tagData.tag}>
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Tag size={18} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">#{tagData.tag}</span>
                      <p className="text-xs text-muted-foreground">
                        {t('usedIn')} {tagData.count} {t('items')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(tagData.tag)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(tagData)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                {index < filteredTags.length - 1 && (
                  <div className="h-px bg-border/50 mx-4" />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-[hsl(var(--glass-bg))] backdrop-blur-xl border border-[hsl(var(--glass-border))] rounded-[20px] p-8 text-center">
            <Tag size={48} className="mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="font-medium text-foreground mb-2">{t('noTagsYet')}</h3>
            <p className="text-sm text-muted-foreground">{t('noTagsDescription')}</p>
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <EditorDialog
        isOpen={showRenameDialog}
        onClose={() => {
          setShowRenameDialog(false);
          setEditingTag(null);
          setNewTagName('');
        }}
        title={t('renameTag')}
        onSave={handleRenameConfirm}
        onCancel={() => {
          setShowRenameDialog(false);
          setEditingTag(null);
          setNewTagName('');
        }}
        saveLabel={t('save')}
        cancelLabel={t('cancel')}
        saveDisabled={!newTagName.trim() || newTagName.trim() === editingTag}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t('enterNewTagName')}
            </label>
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value.toLowerCase().replace(/\s/g, '-'))}
              placeholder={t('tagName')}
              maxLength={30}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {newTagName.length}/30
            </p>
          </div>
        </div>
      </EditorDialog>

      {/* Delete Confirmation */}
      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('deleteTag')}
        description={t('deleteTagConfirmDescription')
          .replace('{tag}', deletingTag?.tag || '')
          .replace('{count}', String(deletingTag?.count || 0))}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingTag(null)}
        action="delete"
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
      />
    </div>
  );
}
