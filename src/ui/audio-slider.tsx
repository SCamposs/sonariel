import { Slider } from "@base-ui/react/slider";

export type AudioSliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  formatValue?: (value: number) => string;
};

export function AudioSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  disabled = false,
  formatValue,
}: AudioSliderProps) {
  return (
    <Slider.Root
      className="ui-audio-slider"
      min={min}
      max={max}
      step={step}
      value={value}
      onValueChange={onChange}
      disabled={disabled}
    >
      <Slider.Control className="ui-slider-control">
        <Slider.Track className="ui-slider-track">
          <Slider.Indicator className="ui-slider-indicator" />
        </Slider.Track>
        <Slider.Thumb
          className="ui-slider-thumb"
          aria-label={label}
          getAriaValueText={
            formatValue
              ? (_formatted, current) => formatValue(current)
              : undefined
          }
        />
      </Slider.Control>
    </Slider.Root>
  );
}
