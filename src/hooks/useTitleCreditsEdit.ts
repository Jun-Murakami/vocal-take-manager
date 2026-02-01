import { useState } from 'react';

interface UseTitleCreditsEditOptions {
  onSaveTitle: (newTitle: string) => void;
  onSaveCredits: (newCredits: string) => void;
}

interface UseTitleCreditsEditReturn {
  isEditingTitle: boolean;
  isEditingCredits: boolean;
  editingTitleText: string;
  editingCreditsText: string;
  setEditingTitleText: (text: string) => void;
  setEditingCreditsText: (text: string) => void;
  startEditingTitle: (currentTitle: string) => void;
  startEditingCredits: (currentCredits: string) => void;
  handleTitleSave: () => void;
  handleCreditsSave: () => void;
}

export function useTitleCreditsEdit(
  options: UseTitleCreditsEditOptions,
): UseTitleCreditsEditReturn {
  const { onSaveTitle, onSaveCredits } = options;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingCredits, setIsEditingCredits] = useState(false);
  const [editingTitleText, setEditingTitleText] = useState('');
  const [editingCreditsText, setEditingCreditsText] = useState('');

  const startEditingTitle = (currentTitle: string) => {
    setEditingTitleText(currentTitle);
    setIsEditingTitle(true);
  };

  const startEditingCredits = (currentCredits: string) => {
    setEditingCreditsText(currentCredits);
    setIsEditingCredits(true);
  };

  const handleTitleSave = () => {
    onSaveTitle(editingTitleText);
    setIsEditingTitle(false);
  };

  const handleCreditsSave = () => {
    onSaveCredits(editingCreditsText);
    setIsEditingCredits(false);
  };

  return {
    isEditingTitle,
    isEditingCredits,
    editingTitleText,
    editingCreditsText,
    setEditingTitleText,
    setEditingCreditsText,
    startEditingTitle,
    startEditingCredits,
    handleTitleSave,
    handleCreditsSave,
  };
}
