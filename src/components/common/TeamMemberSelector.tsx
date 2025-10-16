import React from 'react';
import { MultiSelect } from '@/components/ui/multi-select';
import { UserProfile } from '@/types';

interface MultiSelectOption {
  label: string;
  value: string;
}

interface TeamMemberSelectorProps {
  members: UserProfile[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  label?: string;
  placeholder?: string;
}

export function TeamMemberSelector({
  members,
  selectedIds,
  onSelectionChange,
  label = "Assigned Members",
  placeholder = "Select team members",
}: TeamMemberSelectorProps) {
  const options: MultiSelectOption[] = members.map(member => ({
    label: member.displayName || member.email,
    value: member.uid,
  }));

  return (
    <MultiSelect
      options={options}
      selected={selectedIds}
      onChange={onSelectionChange}
      label={label}
      placeholder={placeholder}
    />
  );
}