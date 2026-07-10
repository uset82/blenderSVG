import { AvatarPanel } from "./components/AvatarPanel";
import { useExtensionBridge } from "./bridge/useExtensionBridge";

export function App() {
  const bridgeState = useExtensionBridge();

  return <AvatarPanel {...bridgeState} />;
}
