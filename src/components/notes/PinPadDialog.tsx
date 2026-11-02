import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Delete } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface PinPadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => boolean | void | Promise<boolean | void>; // Resolve false to trigger shake animation
  mode: 'set' | 'unlock';
  title?: string;
}

export const PinPadDialog = ({ isOpen, onClose, onSubmit, mode, title }: PinPadDialogProps) => {
  const { t } = useLanguage();
  const [pin, setPin] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  
  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setPin('');
      setIsShaking(false);
    }
  }, [isOpen]);
  
  const handleNumberClick = (number: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + number);
    }
  };
  
  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };
  
  const [isChecking, setIsChecking] = useState(false);

  const handleSubmit = async () => {
    if (pin.length === 4 && !isChecking) {
      // Checking a hashed PIN takes a moment; block a second tap meanwhile.
      setIsChecking(true);
      const result = await onSubmit(pin);
      setIsChecking(false);
      
      // If onSubmit returns false, it means PIN was incorrect - trigger shake
      if (result === false) {
        setIsShaking(true);
        setPin('');
        
        // Remove shake class after animation completes
        setTimeout(() => {
          setIsShaking(false);
        }, 500);
      } else {
        // Success - close dialog
        setPin('');
        onClose();
      }
    }
  };
  
  const handleClose = () => {
    setPin('');
    onClose();
  };
  
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-12px)] max-w-[380px] gap-0 rounded-[28px] border-border/70 bg-popover p-6 shadow-xl">
        <DialogHeader className="items-center space-y-3 pt-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
            <Lock size={20} strokeWidth={2} />
          </div>
          <DialogTitle className="text-center text-lg font-semibold tracking-tight">
            {title || (mode === 'set' ? t('setPinCode') : t('enterPinCode'))}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-5">
          {/* PIN Display */}
          <div className={`flex justify-center gap-3 py-1 ${isShaking ? 'animate-shake' : ''}`} aria-label={`${pin.length} of 4 digits entered`}>
            {[0, 1, 2, 3].map(index => (
              <div
                key={index}
                className={`flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200 ${
                  isShaking ? 'bg-destructive/15 ring-2 ring-destructive/70' : pin[index] ? 'bg-primary ring-2 ring-primary/20' : 'border-2 border-muted-foreground/35'
                }`}
              >
              </div>
            ))}
          </div>
          
          {mode === 'set' && (
            <p className="text-sm text-muted-foreground text-center">
              {t('pinCreateHint')}
            </p>
          )}
          
          {isShaking && mode === 'unlock' && (
            <p className="text-sm text-destructive text-center font-medium">
              {t('pinIncorrect')}
            </p>
          )}
          
          {/* Number Pad */}
          <div className="mx-auto grid w-full max-w-[320px] grid-cols-3 gap-2.5">
            {numbers.slice(0, 9).map(number => (
              <Button
                key={number}
                variant="ghost"
                className="h-12 w-full rounded-2xl border border-border bg-muted text-lg font-medium text-foreground hover:border-border hover:bg-hover active:bg-hover"
                onClick={() => handleNumberClick(number)}
                type="button"
              >
                {number}
              </Button>
            ))}
            <div aria-hidden="true" />
            <Button
              variant="ghost"
              className="h-12 w-full rounded-2xl border border-border bg-muted text-lg font-medium text-foreground hover:border-border hover:bg-hover active:bg-hover"
              onClick={() => handleNumberClick('0')}
              type="button"
            >
              0
            </Button>
            <Button
              variant="ghost"
              className="h-12 w-full rounded-2xl border border-border bg-muted text-foreground hover:border-border hover:bg-hover active:bg-hover"
              onClick={handleDelete}
              aria-label="Delete last digit"
              type="button"
            >
              <Delete size={16} />
            </Button>
          </div>
          
          {/* Submit Button */}
          <div className="flex gap-3 pt-1">
            <Button
              variant="outline"
              className="h-11 flex-1 border-border text-foreground hover:bg-hover"
              onClick={handleClose}
              type="button"
            >
              {t('cancel')}
            </Button>
            <Button
              className="h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted-foreground/70 disabled:text-primary-foreground disabled:opacity-100"
              onClick={handleSubmit}
              disabled={pin.length !== 4 || isChecking}
              type="button"
            >
              {mode === 'set' ? t('setPin') : t('unlock')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
