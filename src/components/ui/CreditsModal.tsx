/**
 * @file CreditsModal.tsx
 * The player-facing Credits panel. It lists the third-party assets the game
 * ships, with the credit line each license asks for. Data lives in
 * `src/data/credits.ts`; this file only renders it on the shared ModalDialog.
 *
 * @component-owner UI Team / Core UI
 */
import React from 'react';
import { ModalDialog } from './ModalDialog';
import { CREDIT_SECTIONS, CC_BY_4_URL } from '../../data/credits';
import { UI_ID } from '../../styles/uiIds';
import { t } from '../../utils/core';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LINK_CLASS = 'text-amber-300 underline decoration-amber-300/50 hover:text-amber-200';

export const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => (
  <ModalDialog
    isOpen={isOpen}
    onClose={onClose}
    title={t('credits.title')}
    size="lg"
    showClose
    closeOnBackdrop
    id={UI_ID.CREDITS_MODAL}
    testId={UI_ID.CREDITS_MODAL}
  >
    <p className="mb-4 text-gray-400">{t('credits.intro')}</p>
    {CREDIT_SECTIONS.map((section) => (
      <section key={section.heading} className="mb-4">
        <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-400">{section.heading}</h4>
        <ul className="space-y-2">
          {section.entries.map((entry) => (
            <li key={entry.line} className="rounded-md border border-gray-700/60 bg-gray-800/60 p-3">
              <p className="font-semibold text-gray-100">{entry.line}</p>
              <p className="text-xs text-gray-400">{entry.use}</p>
              {entry.sourceUrl && (
                <a
                  href={entry.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-xs ${LINK_CLASS}`}
                >
                  {t('credits.source_link')}
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    ))}
    <p className="text-xs text-gray-400">
      {t('credits.license_note')}{' '}
      <a href={CC_BY_4_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
        creativecommons.org/licenses/by/4.0
      </a>
    </p>
  </ModalDialog>
);

export default CreditsModal;
