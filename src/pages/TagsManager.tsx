import { useState, useEffect } from 'react';
import { TAG_MAX_LENGTH } from '@/lib/tagLimits';
import { useNavigate } from 'react-router-dom';
import { Tag, Search, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { countedSentence } from '@/lib/countedMessage';
import { useToastSettings } from '@/contexts/ToastContext';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { getAllTagsWithCounts, renameTagGlobally, deleteTagGlobally } from '@/lib/tagStorage';
import { highlightText } from '@/lib/textHighlight';

interface TagWithCount {
  tag: string;
  count: number;
}

export default function TagsManager() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { toast } = useToastSettings();

  // This page renders its own full-height container instead of using <Layout>, so it has to
  // pick the background itself. It reads --background like every other page.

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

    if (trimmedName.length > TAG_MAX_LENGTH) {
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
    /*
     * Plain page background. This screen used to paint a photographic backdrop in light mode
     * only, which made it the one page that did not match the warm off-white palette — and
     * the asset alone was 791 KB. Dark mode already ignored it, so removing it makes both
     * themes consistent with the rest of the app.
     */
    <div className="min-h-screen bg-background">
      {/* Header */}
      <PageHeader title={t('manageTags')} onBack={() => navigate(-1)} />

      {/* Content */}
      <div className="px-2 pb-8 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground" size={20} />
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
                    <Tag size={20} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      {/* Same match highlighting the note and event cards use, so a search
                          behaves the same way wherever it appears in the app. */}
                      <span className="font-medium text-foreground">#{highlightText(tagData.tag, searchQuery)}</span>
                      <p className="text-xs text-muted-foreground">
                        {countedSentence(t, language, 'tagUsedIn', tagData.count)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      aria-label={t('edit')}
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditClick(tagData.tag)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={20} />
                    </Button>
                    <Button
                      aria-label={t('delete')}
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteClick(tagData)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={20} />
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
              maxLength={TAG_MAX_LENGTH}
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {newTagName.length}/{TAG_MAX_LENGTH}
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
