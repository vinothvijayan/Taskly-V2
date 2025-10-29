import { useTheme } from "next-themes"
import { Toaster as Sonner } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:w-[420px] group-[.toaster]:p-4 group-[.toaster]:bg-background/80 group-[.toaster]:backdrop-blur-lg group-[.toaster]:text-foreground group-[.toaster]:border-border/50 group-[.toaster]:shadow-elegant rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          icon: "group-[.toast]:text-primary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }