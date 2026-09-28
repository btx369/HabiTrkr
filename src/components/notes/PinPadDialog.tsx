import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Lock, Delete } from 'lucide-react';

interface PinPadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => boolean | void; // Return false to trigger shake animation
  mode: 'set' | 'unlock';
  title?: string;
}

export const PinPadDialog = ({ isOpen, onClose, onSubmit, mode, title }: PinPadDialogProps) => {
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
  
  const handleSubmit = () => {
    if (pin.length === 4) {
      const result = onSubmit(pin);
      
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
      <DialogContent className="w-80 max-w-none">
        <DialogHeader>
          <DialogTitle className="text-center flex items-center justify-center gap-2">
            <Lock size={18} />
            {title || (mode === 'set' ? 'Set PIN Code' : 'Enter PIN Code')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* PIN Display */}
          <div className={`flex justify-center gap-2 ${isShaking ? 'animate-shake' : ''}`}>
            {[0, 1, 2, 3].map(index => (
              <div
                key={index}
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                  isShaking ? 'border-destructive' : 'border-primary'
                }`}
              >
                {pin[index] && (
                  <div className={`w-2 h-2 rounded-full ${isShaking ? 'bg-destructive' : 'bg-foreground'}`} />
                )}
              </div>
            ))}
          </div>
          
          {mode === 'set' && (
            <p className="text-sm text-muted-foreground text-center">
              Create a 4-digit PIN to lock this note
            </p>
          )}
          
          {isShaking && mode === 'unlock' && (
            <p className="text-sm text-destructive text-center font-medium">
              Incorrect PIN
            </p>
          )}
          
          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3 max-w-48 mx-auto">
            {numbers.slice(0, 9).map(number => (
              <Button
                key={number}
                variant="outline"
                size="lg"
                className="h-12 w-12 text-lg font-medium border-primary rounded-full"
                onClick={() => handleNumberClick(number)}
              >
                {number}
              </Button>
            ))}
            <div /> {/* Empty space */}
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-12 text-lg font-medium border-primary rounded-full"
              onClick={() => handleNumberClick('0')}
            >
              0
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 w-12 border-primary rounded-full"
              onClick={handleDelete}
            >
              <Delete size={16} />
            </Button>
          </div>
          
          {/* Submit Button */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-primary text-primary hover:text-primary"
              onClick={handleClose}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSubmit}
              disabled={pin.length !== 4}
            >
              {mode === 'set' ? 'Set PIN' : 'Unlock'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
