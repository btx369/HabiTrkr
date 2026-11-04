import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ChevronRight, 
  Shield, 
  Tag, 
  Sun, 
  Moon, 
  Bell, 
  BellOff,
  Globe, 
  Calendar, 
  Download, 
  Upload,
  HelpCircle,
  Trash2,
  Camera,
  Check,
  FileText,
  Lock,
  MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PROFILE_AVATAR_KEY, PROFILE_NAME_KEY } from '@/lib/storageKeys';
import { applyBackup, BackupError, createBackup, readBackup } from '@/lib/backup';
import { clearAllAppData } from '@/lib/backup';
import { FeedbackDialog } from '@/components/shared/FeedbackDialog';
import { SettingsDivider, SettingsRow, SettingsSection, settingsPanelClass } from '@/components/shared/SettingsRow';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage, Language, nativeLanguageNames } from '@/contexts/LanguageContext';
import { useWeekStart, WeekStartDay } from '@/contexts/WeekStartContext';
import { useToastSettings } from '@/contexts/ToastContext';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { PageHeader } from '@/components/shared/PageHeader';
import { getLocalStorageString, setLocalStorageString } from '@/lib/localStorageUtils';

export default function Profile() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { weekStartDay, setWeekStartDay } = useWeekStart();
  const { toastsEnabled, setToastsEnabled, toast } = useToastSettings();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [languageDialogOpen, setLanguageDialogOpen] = useState(false);
  const [weekStartDialogOpen, setWeekStartDialogOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

  // Apagar todos os dados: everything this app stored on this device, then a fresh start.
  const handleDeleteAllData = () => {
    clearAllAppData();
    window.location.replace(import.meta.env.BASE_URL);
  };

  /*
   * 'User' is the placeholder name shown until the user types their own, and it stays in
   * English on purpose.
   *
   * The moment it is written it becomes DATA — it is stored under PROFILE_NAME_KEY and read
   * back as the person's name, exactly like a note's title. Translating it would either
   * store whichever language happened to be active when the profile was first opened, so the
   * name would never follow a language change, or require keeping it as a separate
   * "is this still the default?" flag. Neither is worth it for a placeholder the user is
   * expected to replace.
   */
  const [userName, setUserName] = useState(() => getLocalStorageString(PROFILE_NAME_KEY, 'User'));
  const [userAvatar, setUserAvatar] = useState(() => getLocalStorageString(PROFILE_AVATAR_KEY, ''));
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(createBackup(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `habitrkr-backup-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(t('backupDownloaded'));
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setShowImportConfirm(true);
    if (e.target) e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (!pendingFile) return;
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(await pendingFile.text());
      } catch {
        throw new BackupError('invalid');
      }
      applyBackup(readBackup(parsed));
      toast.success(t('importSuccess'));
      setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      console.error('Import error:', err);
      const storageFull = err instanceof BackupError && err.reason === 'storage';
      toast.error(t(storageFull ? 'importStorageFull' : 'invalidBackupFile'));
    } finally {
      setPendingFile(null);
    }
  };

  const handleAvatarClick = () => avatarInputRef.current?.click();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      // Compress image using canvas
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let width = img.width;
        let height = img.height;
        
        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);
        setUserAvatar(compressedBase64);
        setLocalStorageString(PROFILE_AVATAR_KEY, compressedBase64);
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  const handleNameSave = () => {
    const trimmedName = tempName.trim() || 'User';
    setUserName(trimmedName);
    setLocalStorageString(PROFILE_NAME_KEY, trimmedName);
    setIsEditingName(false);
  };

  const getWeekStartLabel = () => {
    if (weekStartDay === 'monday') return t('monday');
    if (weekStartDay === 'saturday') return t('saturday');
    return t('sunday');
  };

  const bgColor = 'hsl(var(--background))';
  const profilePanelClass = settingsPanelClass;

  return (
    <div 
      className="min-h-screen"
      style={{ backgroundColor: bgColor }}
    >
      {/* Header */}
      <PageHeader title={t('profile')} onBack={() => navigate(-1)} />

      {/* Content */}
      <div className="px-2 pb-8 space-y-6">
        {/* Profile Card */}
        <div className={`${profilePanelClass} p-6`}>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={handleAvatarClick}
                className="w-20 h-20 rounded-full overflow-hidden bg-muted flex items-center justify-center border-2 border-primary/20 hover:border-primary/50 transition-colors"
              >
                {userAvatar ? (
                  <img src={userAvatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold text-muted-foreground">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                )}
              </button>
              <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full p-1.5">
                <Camera size={12} />
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="flex-1">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                    className="flex-1 bg-background/50 border border-primary/30 rounded-lg px-3 py-2 text-lg font-medium focus:outline-none focus:border-primary"
                    autoFocus
                    maxLength={30}
                  />
                  <Button size="sm" onClick={handleNameSave} className="rounded-full">
                    <Check size={20} />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={() => { setTempName(userName); setIsEditingName(true); }}
                  className="text-left"
                >
                  <h2 className="text-xl font-semibold text-foreground">{userName}</h2>
                  <p className="text-sm text-muted-foreground">{t('tapToEdit')}</p>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Account Section */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">{t('account')}</h3>
          <div className={`${profilePanelClass} overflow-hidden`}>
            <SettingsRow
              icon={<Shield size={20} />}
              label={t('security')}
              onClick={() => navigate('/security')}
              showChevron
            />
            <div className="h-px bg-border mx-4" />
            <SettingsRow
              icon={<Tag size={20} />}
              label={t('tags')}
              onClick={() => navigate('/tags')}
            />
          </div>
        </div>

        {/* Preferences Section */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">{t('preferences')}</h3>
          <div className={`${profilePanelClass} overflow-hidden`}>
            <SettingsRow
              icon={theme === 'dark' ? <Moon size={20} /> : <Sun size={20} />}
              label={t('theme')}
              value={theme === 'dark' ? t('dark') : t('light')}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              rightElement={
                <Switch 
                  checked={theme === 'dark'} 
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                  className="border-foreground/70 data-[state=unchecked]:bg-card data-[state=unchecked]:border-foreground/70 dark:data-[state=unchecked]:bg-muted [&_[data-state=unchecked]]:bg-foreground"
                  thumbClassName="data-[state=unchecked]:translate-x-0.5"
                />
              }
            />
            <div className="h-px bg-border mx-4" />
            <SettingsRow
              icon={toastsEnabled ? <Bell size={20} /> : <BellOff size={20} />}
              label={t('notifications')}
              value={toastsEnabled ? t('on') : t('off')}
              onClick={() => setToastsEnabled(!toastsEnabled)}
              rightElement={
                <Switch 
                  checked={toastsEnabled} 
                  onCheckedChange={setToastsEnabled}
                  className="border-foreground/70 data-[state=unchecked]:bg-card data-[state=unchecked]:border-foreground/70 dark:data-[state=unchecked]:bg-muted [&_[data-state=unchecked]]:bg-foreground"
                  thumbClassName="data-[state=unchecked]:translate-x-0.5"
                />
              }
            />
            <div className="h-px bg-border mx-4" />
            <SettingsRow
              icon={<Globe size={20} />}
              label={t('language')}
              value={nativeLanguageNames[language]}
              onClick={() => setLanguageDialogOpen(true)}
              showChevron
            />
            <div className="h-px bg-border mx-4" />
            <SettingsRow
              icon={<Calendar size={20} />}
              label={t('weekStartsOn')}
              value={getWeekStartLabel()}
              onClick={() => setWeekStartDialogOpen(true)}
              showChevron
            />

            {/* Language Selection Dialog */}
            <Dialog open={languageDialogOpen} onOpenChange={setLanguageDialogOpen}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-[200px] rounded-[20px]" hideCloseButton>
                <DialogHeader>
                  <DialogTitle className="text-center">{t('language')}</DialogTitle>
                </DialogHeader>
                <div className="max-h-[50vh] overflow-y-auto no-scrollbar">
                  {(Object.keys(nativeLanguageNames) as Language[]).map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLanguage(lang);
                        setLanguageDialogOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-hover transition-colors"
                    >
                      <span>{nativeLanguageNames[lang]}</span>
                      {language === lang && <Check className="h-5 w-5 text-primary" />}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            {/* Week Start Selection Dialog */}
            <Dialog open={weekStartDialogOpen} onOpenChange={setWeekStartDialogOpen}>
              <DialogContent className="w-[calc(100%-2rem)] max-w-[200px] rounded-[20px]" hideCloseButton>
                <DialogHeader>
                  <DialogTitle className="text-center">{t('weekStartsOn')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-1">
                  {(['monday', 'saturday', 'sunday'] as WeekStartDay[]).map((day) => (
                    <button
                      key={day}
                      onClick={() => {
                        setWeekStartDay(day);
                        setWeekStartDialogOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-hover transition-colors"
                    >
                      <span>{t(day)}</span>
                      {weekStartDay === day && <Check className="h-5 w-5 text-primary" />}
                    </button>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
            <div className="h-px bg-border mx-4" />
            {/* Stacked on phones: the label plus two buttons do not fit on one row at
                390px, which previously pushed the Import button past the card edge. */}
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-foreground shrink-0" />
                {/* text-sm for the same reason as SettingsRow: otherwise it inherits the
                    16px body size and sits a step above every other label on the page. */}
                <span className="text-sm font-medium text-foreground">{t('dataStorage')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
                  onClick={handleExport}
                >
                  <Download className="h-5 w-5 mr-1" /> {t('exportBackup')}
                </Button>
                <Button 
                  variant="default" 
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-full"
                  onClick={handleImportClick}
                >
                  <Upload className="h-5 w-5 mr-1" /> {t('importBackup')}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            </div>
          </div>
        </div>

        <SettingsSection title={t('support')}>
          <SettingsRow icon={<MessageSquare size={20} />} label={t('feedback')} onClick={() => setFeedbackOpen(true)} />
          <SettingsDivider />
          <SettingsRow icon={<HelpCircle size={20} />} label={t('helpAbout')} onClick={() => navigate('/about')} showChevron />
          <SettingsDivider />
          <SettingsRow icon={<FileText size={20} />} label={t('termsOfService')} onClick={() => navigate('/terms')} showChevron />
          <SettingsDivider />
          <SettingsRow icon={<Lock size={20} />} label={t('privacyPolicy')} onClick={() => navigate('/privacy')} showChevron />
        </SettingsSection>

        {/* "Terminar sessão" returns with Google sign-in; there is no account to leave yet. */}
        <SettingsSection title={t('dangerZone')}>
          <SettingsRow
            icon={<Trash2 size={20} className="text-destructive" />}
            label={t('deleteAllData')}
            labelClassName="text-destructive"
            onClick={() => setDeleteAllOpen(true)}
          />
        </SettingsSection>
      </div>

      <FeedbackDialog isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />

      <ConfirmationDialog
        open={deleteAllOpen}
        onOpenChange={setDeleteAllOpen}
        title={t('deleteAllDataTitle')}
        description={t('deleteAllDataDescription')}
        onConfirm={handleDeleteAllData}
        action="delete"
        confirmLabel={t('deleteAllData')}
        cancelLabel={t('cancel')}
      />

      <ConfirmationDialog
        open={showImportConfirm}
        onOpenChange={setShowImportConfirm}
        title={t('importConfirmTitle')}
        description={t('importConfirmDescription')}
        onConfirm={handleConfirmImport}
        onCancel={() => setPendingFile(null)}
        action="import"
        confirmLabel={t('import')}
        cancelLabel={t('cancel')}
      />
    </div>
  );
}

// Reusable Settings Row Component
