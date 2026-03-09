"use client"

import * as React from "react"
import { AlertCircle, CheckCircle2, Info, TriangleAlert, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type DialogKind = "info" | "success" | "warning" | "error"

interface AlertDialogState {
  open: boolean
  title: string
  message: string
  kind: DialogKind
  mode: "message" | "confirm" | "ask"
  resolve?: (value: boolean) => void
}

export function useTauriDialog() {
  const [state, setState] = React.useState<AlertDialogState>({
    open: false,
    title: "",
    message: "",
    kind: "info",
    mode: "message",
  })

  const message = (msg: string, options?: { title?: string; kind?: DialogKind }) => {
    return new Promise<void>((resolve) => {
      setState({
        open: true,
        title: options?.title || "提示",
        message: msg,
        kind: options?.kind || "info",
        mode: "message",
        resolve: () => {
          resolve()
        },
      })
    })
  }

  const confirm = (msg: string, options?: { title?: string; kind?: DialogKind }) => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        title: options?.title || "确认",
        message: msg,
        kind: options?.kind || "info",
        mode: "confirm",
        resolve: (value: boolean) => resolve(value),
      })
    })
  }

  const ask = (msg: string, options?: { title?: string; kind?: DialogKind }) => {
    return new Promise<boolean>((resolve) => {
      setState({
        open: true,
        title: options?.title || "询问",
        message: msg,
        kind: options?.kind || "info",
        mode: "ask",
        resolve: (value: boolean) => resolve(value),
      })
    })
  }

  const handleClose = (value?: boolean) => {
    setState((prev) => {
      if (prev.resolve) {
        if (prev.mode === "message") {
          prev.resolve()
        } else {
          prev.resolve(value ?? false)
        }
      }
      return { ...prev, open: false }
    })
  }

  const DialogComponent = () => {
    const icons = {
      info: <Info className="h-5 w-5 text-blue-500" />,
      success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      warning: <TriangleAlert className="h-5 w-5 text-yellow-500" />,
      error: <AlertCircle className="h-5 w-5 text-red-500" />,
    }

    const iconColors = {
      info: "bg-blue-50 dark:bg-blue-950",
      success: "bg-green-50 dark:bg-green-950",
      warning: "bg-yellow-50 dark:bg-yellow-950",
      error: "bg-red-50 dark:bg-red-950",
    }

    return (
      <Dialog open={state.open} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="flex flex-row items-start gap-4">
            <div className={`mt-1 rounded-full p-2 ${iconColors[state.kind]}`}>
              {icons[state.kind]}
            </div>
            <div className="flex-1">
              <DialogTitle>{state.title}</DialogTitle>
              <DialogDescription className="mt-1 text-base">
                {state.message}
              </DialogDescription>
            </div>
          </DialogHeader>
          <DialogFooter className="sm:justify-end gap-2">
            {state.mode === "message" ? (
              <Button onClick={() => handleClose()} className="w-full sm:w-auto">
                确定
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleClose(false)}
                >
                  {state.mode === "confirm" ? "取消" : "否"}
                </Button>
                <Button
                  onClick={() => handleClose(true)}
                >
                  {state.mode === "confirm" ? "确认" : "是"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return {
    message,
    confirm,
    ask,
    DialogComponent,
  }
}
