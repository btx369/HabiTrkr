import { useLocalStorage } from './useLocalStorage';
import { PremiumAccount } from '@/types/premium';

export function usePremiumAccount(): [PremiumAccount, (account: PremiumAccount) => void] {
  const [premiumAccount, setPremiumAccount] = useLocalStorage<PremiumAccount>('premiumAccount', {
    isPremium: false
  });

  return [premiumAccount, setPremiumAccount];
}
