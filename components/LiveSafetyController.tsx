import { useShareSession, type ShareSessionState } from '../hooks/useShareSession';
import { useTrustedContact } from '../hooks/useTrustedContact';
import type { TrustedContact } from '../lib/api/trusted-contact';

export type LiveSafetyControllerState = {
  shareState: ShareSessionState;
  contact: TrustedContact | null;
  pillVisible: boolean;
};

export function useLiveSafetyController(): LiveSafetyControllerState {
  const shareState = useShareSession();
  const contactState = useTrustedContact();
  const session = shareState.ready ? shareState.session : null;
  const contact = contactState.ready ? contactState.contact : null;

  return {
    shareState,
    contact,
    pillVisible: !!session && !!contact,
  };
}
