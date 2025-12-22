
import { COMPANIONS } from '../constants';

type TimeoutID = ReturnType<typeof setTimeout>;
let activeTimeouts: TimeoutID[] = [];

export const BanterDisplayService = {
  queueBanter: (
    lines: { text: string; speakerId: string; delay?: number }[],
    addMessage: (text: string, sender: string) => void,
    companions: Record<string, any>
  ) => {
    // Clear any existing banter to prevent overlap
    BanterDisplayService.cancelActiveBanter();

    let delayAccumulator = 2000;

    lines.forEach(line => {
      const speaker = companions[line.speakerId] || COMPANIONS[line.speakerId];
      const speakerName = speaker ? speaker.identity.name : "Unknown";

      const timeoutId = setTimeout(() => {
        addMessage(`"${line.text}"`, speakerName);
      }, delayAccumulator);

      activeTimeouts.push(timeoutId);
      delayAccumulator += (line.delay || 3000);
    });
  },

  cancelActiveBanter: () => {
    activeTimeouts.forEach(id => clearTimeout(id));
    activeTimeouts = [];
  }
};
