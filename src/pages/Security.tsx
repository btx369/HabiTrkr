import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, KeyRound } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/shared/PageHeader';
import { SettingsDivider, SettingsRow, SettingsSection } from '@/components/shared/SettingsRow';
import { NotePasswordDialog, NotePasswordMode, NotePasswordValues } from '@/components/notes/NotePasswordDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToastSettings } from '@/contexts/ToastContext';
import {
  changeVaultPassword,
  createVault,
  disableBiometric,
  enableBiometric,
  hasBiometric,
  hasVault,
  isBiometricAvailable,
  lockVault,
  unlockVault,
  VAULT_ATTEMPTS_ID,
} from '@/lib/noteVault';
import { clearPinFailures, getPinLockoutRemaining, recordPinFailure } from '@/lib/notePin';

/** Everything that protects the user's data: the note password and fingerprint unlock. */
export default function Security() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { toast } = useToastSettings();

  const [passwordDialogMode, setPasswordDialogMode] = useState<NotePasswordMode | null>(null);
  const [vaultExists, setVaultExists] = useState(() => hasVault());
  const [biometricOn, setBiometricOn] = useState(() => hasBiometric());
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBiometricAvailable);
  }, []);

  const handleBiometricToggle = (checked: boolean) => {
    if (checked) {
      setPasswordDialogMode('unlock');
    } else {
      disableBiometric();
      setBiometricOn(false);
      toast.success(t('fingerprintDisabled'));
    }
  };

  const tooManyAttempts = () => {
    const waitMs = getPinLockoutRemaining(VAULT_ATTEMPTS_ID);
    return waitMs > 0 ? t('pinTooManyAttempts').replace('{seconds}', String(Math.ceil(waitMs / 1000))) : null;
  };

  // Creating or changing the note password, or proving it to turn the fingerprint on.
  // Changing re-wraps the key that encrypts the notes; the notes themselves are not rewritten.
  const handleNotePassword = async ({ password, currentPassword }: NotePasswordValues): Promise<string | null> => {
    if (passwordDialogMode === 'unlock') {
      const locked = tooManyAttempts();
      if (locked) return locked;
      if (!(await unlockVault(password))) {
        recordPinFailure(VAULT_ATTEMPTS_ID);
        return t('notePasswordIncorrect');
      }
      clearPinFailures(VAULT_ATTEMPTS_ID);
      try {
        const result = await enableBiometric();
        if (result === 'enabled') {
          setBiometricOn(true);
          toast.success(t('fingerprintEnabled'));
        } else {
          toast.error(t(result === 'unsupported' ? 'fingerprintUnsupported' : 'fingerprintFailed'));
        }
      } finally {
        lockVault();
      }
      return null;
    }
    if (passwordDialogMode === 'change') {
      const locked = tooManyAttempts();
      if (locked) return locked;
      if (!(await changeVaultPassword(currentPassword ?? '', password))) {
        recordPinFailure(VAULT_ATTEMPTS_ID);
        return t('notePasswordIncorrect');
      }
      clearPinFailures(VAULT_ATTEMPTS_ID);
    } else {
      await createVault(password);
      lockVault(); // nothing is open on this page; keep the key out of memory
      setVaultExists(true);
    }
    toast.success(t('notePasswordSaved'));
    return null;
  };

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t('security')} onBack={() => navigate(-1)} />

      <div className="px-2 pb-8 space-y-6">
        <SettingsSection title={t('protectedNotes')}>
          <SettingsRow
            icon={<KeyRound size={20} />}
            label={t('notePasswordProfileLabel')}
            value={vaultExists ? t('notePasswordSet') : t('notePasswordNotSet')}
            onClick={() => setPasswordDialogMode(vaultExists ? 'change' : 'create')}
          />
          {vaultExists && biometricAvailable && (
            <>
              <SettingsDivider />
              <SettingsRow
                icon={<Fingerprint size={20} />}
                label={t('fingerprintUnlock')}
                onClick={() => handleBiometricToggle(!biometricOn)}
                rightElement={<Switch checked={biometricOn} onCheckedChange={handleBiometricToggle} />}
              />
            </>
          )}
        </SettingsSection>

        <p className="px-2 text-sm text-muted-foreground">{t('securityExplainer')}</p>
      </div>

      <NotePasswordDialog
        isOpen={passwordDialogMode !== null}
        mode={passwordDialogMode ?? 'create'}
        onClose={() => setPasswordDialogMode(null)}
        onSubmit={handleNotePassword}
      />
    </div>
  );
}
