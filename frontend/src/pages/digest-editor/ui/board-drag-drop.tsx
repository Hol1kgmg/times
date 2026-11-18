import { DragDropProvider } from "@dnd-kit/react";
import { move } from "@dnd-kit/helpers";
import { useRef } from "react";
import type { ReactNode } from "react";
import { fromIds, isBoxId, moveToBoxEnd, toIds } from "../model/board";
import type { Board } from "../model/board";
import { plugins } from "./announcements";

interface BoardDragDropProps {
  board: Board;
  onChange: (board: Board) => void;
  onDrag: (board: Board) => void;
  children: ReactNode;
}

export const BoardDragDrop = ({ board, onChange, onDrag, children }: BoardDragDropProps) => {
  // Esc でドラッグをやめたとき、ドラッグ中に組み替えた並びを戻す
  const beforeDrag = useRef<Board>(undefined);
  return (
    <DragDropProvider
      plugins={plugins}
      onDragEnd={(e) => {
        onChange(e.canceled && beforeDrag.current !== undefined ? beforeDrag.current : board);
        beforeDrag.current = undefined;
      }}
      onDragOver={(e) => {
        const { source, target } = e.operation;
        if (source !== null && target !== null && isBoxId(target.id)) {
          onDrag(moveToBoxEnd(board, String(source.id), target.id));
          return;
        }
        const ids = toIds(board);
        const next = move(ids, e);
        // ポインター移動の大半は並びが変わらないので、ここで打ち切って再描画を避ける
        if (next !== ids) {
          onDrag(fromIds(board, next));
        }
      }}
      onDragStart={() => {
        beforeDrag.current = board;
      }}
    >
      {children}
    </DragDropProvider>
  );
};
