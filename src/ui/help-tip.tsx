import { useId, useState, type ReactNode, type ReactElement } from "react";
import { Tooltip } from "@base-ui/react/tooltip";
import { CircleHelp } from "lucide-react";
import "./help-tip.css";

/** App-owned appearance; Base UI owns focus, hover, Escape and positioning. */
export function HelpTip({ label, children, trigger }: { label: string; children: ReactNode; trigger?: ReactElement }) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  return <Tooltip.Provider delay={350} closeDelay={100}>
    <Tooltip.Root open={open} onOpenChange={setOpen}>
      <Tooltip.Trigger render={trigger} className={trigger ? undefined : "help-tip-trigger"} aria-label={trigger ? undefined : label} closeOnClick={Boolean(trigger)}
        aria-describedby={open ? descriptionId : undefined}
        onClick={trigger ? undefined : event => { event.stopPropagation(); setOpen(true); }}>
        {trigger ? undefined : <CircleHelp size={17} aria-hidden="true" />}
      </Tooltip.Trigger>
      <Tooltip.Portal><Tooltip.Positioner side="bottom" align="start" sideOffset={8} collisionPadding={12} className="help-tip-positioner">
        <Tooltip.Popup className="help-tip-popup" id={descriptionId} role="tooltip">{children}</Tooltip.Popup>
      </Tooltip.Positioner></Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>;
}

export function StatusBadge({ children, tone = "", help, label }: {
  children: ReactNode; tone?: string; help?: string; label?: string;
}) {
  const badge = <span className={`badge ${tone}`} tabIndex={help ? 0 : undefined}
    onClick={help ? event => event.stopPropagation() : undefined}><i aria-hidden="true" />{children}</span>;
  return <span className="status-with-help">{help ? <HelpTip label={label ?? help} trigger={badge}>{help}</HelpTip> : badge}</span>;
}

export function Requirements({ required, optional }: { required: string; optional?: string }) {
  return <div className="requirements-summary"><p>{required}</p>{optional && <p className="muted">{optional}</p>}</div>;
}
