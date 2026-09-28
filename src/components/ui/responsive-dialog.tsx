import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

interface ResponsiveDialogContentProps {
  children: React.ReactNode;
  className?: string;
  hideCloseButton?: boolean;
  style?: React.CSSProperties;
}

export function ResponsiveDialogContent({ 
  children, 
  className,
  hideCloseButton = true,
  style
}: ResponsiveDialogContentProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerContent className={className} style={style}>
        {children}
      </DrawerContent>
    );
  }

  return (
    <DialogContent hideCloseButton={hideCloseButton} className={className} style={style}>
      {children}
    </DialogContent>
  );
}

interface ResponsiveDialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogHeader({ children, className }: ResponsiveDialogHeaderProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerHeader className={className}>{children}</DrawerHeader>;
  }

  return <DialogHeader className={className}>{children}</DialogHeader>;
}

interface ResponsiveDialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogTitle({ children, className }: ResponsiveDialogTitleProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerTitle className={className}>{children}</DrawerTitle>;
  }

  return <DialogTitle className={className}>{children}</DialogTitle>;
}

interface ResponsiveDialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveDialogFooter({ children, className }: ResponsiveDialogFooterProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <DrawerFooter className={className}>{children}</DrawerFooter>;
  }

  return <DialogFooter className={className}>{children}</DialogFooter>;
}
