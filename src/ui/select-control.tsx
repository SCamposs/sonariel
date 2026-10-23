import { Select } from "@base-ui/react/select";
import { Check, ChevronDown } from "lucide-react";

export type SelectOption = { value: string; label: string };

export type SelectControlProps = {
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  name?: string;
};

/** Sonariel owns this contract and its CSS; the interaction engine is replaceable. */
export function SelectControl({
  label,
  value,
  options,
  onChange,
  placeholder = "Selecione",
  disabled,
  name,
}: SelectControlProps) {
  return (
    <Select.Root
      items={options}
      value={value || null}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
      disabled={disabled || options.length === 0}
      name={name}
    >
      <Select.Trigger className="ui-select-trigger" aria-label={label}>
        <Select.Value placeholder={placeholder} />
        <Select.Icon className="ui-select-icon">
          <ChevronDown size={15} />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner
          className="ui-select-positioner"
          sideOffset={6}
          alignItemWithTrigger={false}
        >
          <Select.Popup className="ui-select-popup">
            <Select.List className="ui-select-list">
              {options.map((option) => (
                <Select.Item
                  className="ui-select-item"
                  key={option.value}
                  value={option.value}
                >
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator className="ui-select-check">
                    <Check size={14} />
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
