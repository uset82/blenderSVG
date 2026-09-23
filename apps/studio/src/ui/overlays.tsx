import {
  DropdownMenu,
  Dialog as RadixDialog,
  Popover as RadixPopover,
  Tabs as RadixTabs,
  Toast as RadixToast
} from "radix-ui";
import type { ComponentProps } from "react";
import { cx, studioPortalContainer } from "./shared.js";

function TabList({ className, ...props }: ComponentProps<typeof RadixTabs.List>) {
  return <RadixTabs.List {...props} className={cx("studio-ui-tabs__list", className)} />;
}

function TabTrigger({ className, ...props }: ComponentProps<typeof RadixTabs.Trigger>) {
  return <RadixTabs.Trigger {...props} className={cx("studio-ui-tabs__trigger", className)} />;
}

function TabContent({ className, ...props }: ComponentProps<typeof RadixTabs.Content>) {
  return <RadixTabs.Content {...props} className={cx("studio-ui-tabs__content", className)} />;
}

export const Tabs = {
  Root: RadixTabs.Root,
  List: TabList,
  Trigger: TabTrigger,
  Content: TabContent
};

function MenuContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal container={studioPortalContainer()}>
      <DropdownMenu.Content {...props} sideOffset={sideOffset} className={cx("studio-ui-menu__content", className)} />
    </DropdownMenu.Portal>
  );
}

function MenuSubContent({ className, sideOffset = 4, ...props }: ComponentProps<typeof DropdownMenu.SubContent>) {
  return (
    <DropdownMenu.Portal container={studioPortalContainer()}>
      <DropdownMenu.SubContent
        {...props}
        sideOffset={sideOffset}
        className={cx("studio-ui-menu__content", className)}
      />
    </DropdownMenu.Portal>
  );
}

function MenuItem({ className, ...props }: ComponentProps<typeof DropdownMenu.Item>) {
  return <DropdownMenu.Item {...props} className={cx("studio-ui-menu__item", className)} />;
}

function MenuCheckboxItem({ className, ...props }: ComponentProps<typeof DropdownMenu.CheckboxItem>) {
  return <DropdownMenu.CheckboxItem {...props} className={cx("studio-ui-menu__item", className)} />;
}

function MenuRadioItem({ className, ...props }: ComponentProps<typeof DropdownMenu.RadioItem>) {
  return <DropdownMenu.RadioItem {...props} className={cx("studio-ui-menu__item", className)} />;
}

function MenuSubTrigger({ className, ...props }: ComponentProps<typeof DropdownMenu.SubTrigger>) {
  return <DropdownMenu.SubTrigger {...props} className={cx("studio-ui-menu__item", className)} />;
}

function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label {...props} className={cx("studio-ui-menu__label", className)} />;
}

function MenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator {...props} className={cx("studio-ui-menu__separator", className)} />;
}

export const Menu = {
  Root: DropdownMenu.Root,
  Trigger: DropdownMenu.Trigger,
  Content: MenuContent,
  Item: MenuItem,
  CheckboxItem: MenuCheckboxItem,
  RadioGroup: DropdownMenu.RadioGroup,
  RadioItem: MenuRadioItem,
  ItemIndicator: DropdownMenu.ItemIndicator,
  Sub: DropdownMenu.Sub,
  SubTrigger: MenuSubTrigger,
  SubContent: MenuSubContent,
  Label: MenuLabel,
  Separator: MenuSeparator,
  Group: DropdownMenu.Group
};

function PopoverContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof RadixPopover.Content>) {
  return (
    <RadixPopover.Portal container={studioPortalContainer()}>
      <RadixPopover.Content
        {...props}
        sideOffset={sideOffset}
        className={cx("studio-ui-popover__content", className)}
      />
    </RadixPopover.Portal>
  );
}

export const Popover = {
  Root: RadixPopover.Root,
  Anchor: RadixPopover.Anchor,
  Trigger: RadixPopover.Trigger,
  Content: PopoverContent,
  Close: RadixPopover.Close
};

function DialogContent({ className, children, ...props }: ComponentProps<typeof RadixDialog.Content>) {
  return (
    <RadixDialog.Portal container={studioPortalContainer()}>
      <RadixDialog.Overlay className="studio-ui-dialog__overlay" />
      <RadixDialog.Content {...props} className={cx("studio-ui-dialog__content", className)}>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

function DialogTitle({ className, ...props }: ComponentProps<typeof RadixDialog.Title>) {
  return <RadixDialog.Title {...props} className={cx("studio-ui-dialog__title", className)} />;
}

function DialogDescription({ className, ...props }: ComponentProps<typeof RadixDialog.Description>) {
  return <RadixDialog.Description {...props} className={cx("studio-ui-dialog__description", className)} />;
}

export const Dialog = {
  Root: RadixDialog.Root,
  Trigger: RadixDialog.Trigger,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: RadixDialog.Close
};

function ToastViewport({ className, ...props }: ComponentProps<typeof RadixToast.Viewport>) {
  return <RadixToast.Viewport {...props} className={cx("studio-ui-toast__viewport", className)} />;
}

function ToastRoot({ className, ...props }: ComponentProps<typeof RadixToast.Root>) {
  return <RadixToast.Root {...props} className={cx("studio-ui-toast__root", className)} />;
}

function ToastTitle({ className, ...props }: ComponentProps<typeof RadixToast.Title>) {
  return <RadixToast.Title {...props} className={cx("studio-ui-toast__title", className)} />;
}

function ToastDescription({ className, ...props }: ComponentProps<typeof RadixToast.Description>) {
  return <RadixToast.Description {...props} className={cx("studio-ui-toast__description", className)} />;
}

export const Toast = {
  Provider: RadixToast.Provider,
  Viewport: ToastViewport,
  Root: ToastRoot,
  Title: ToastTitle,
  Description: ToastDescription,
  Action: RadixToast.Action,
  Close: RadixToast.Close
};
