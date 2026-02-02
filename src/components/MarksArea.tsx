/**
 * MarksArea
 * - Recording/Comping のマークエリア（ヘッダー + 本文）を共通化する
 * - 画面ごとの差分は render 関数とオプション列で吸収する
 */

import { Box } from '@mui/material';

import type { SxProps, Theme } from '@mui/material/styles';
import type { ReactNode, RefObject } from 'react';
import type { Take } from '@/types/models';

interface MarksAreaProps {
  // テイク一覧
  takes: Take[];
  // スクロール参照とハンドラ
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  // ヘッダー列と本文列の描画
  renderHeaderCell: (take: Take) => ReactNode;
  renderBodyColumn: (take: Take, takeIndex: number) => ReactNode;
  // 追加の操作列（Recording の +/- 列など）
  headerControlColumn?: ReactNode;
  bodyControlColumn?: ReactNode;
  // 末尾スペーサー（最後のテイクを左寄せするため）
  trailingSpacerWidth?: number;
  // スクロール領域のスタイル
  scrollSx?: SxProps<Theme>;
  // ヘッダーのスタイル
  headerStickySx?: SxProps<Theme>;
  headerRowSx?: SxProps<Theme>;
  // 本文のスタイル
  bodyRowSx?: SxProps<Theme>;
}

export function MarksArea({
  takes,
  scrollRef,
  onScroll,
  renderHeaderCell,
  renderBodyColumn,
  headerControlColumn,
  bodyControlColumn,
  trailingSpacerWidth = 0,
  scrollSx,
  headerStickySx,
  headerRowSx,
  bodyRowSx,
}: MarksAreaProps) {
  return (
    <Box
      ref={scrollRef}
      onScroll={onScroll}
      sx={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'auto',
        minWidth: 0,
        ...scrollSx,
      }}
    >
      {/* Take header row - sticky */}
      <Box
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 2,
          bgcolor: 'background.paper',
          ...headerStickySx,
        }}
      >
        <Box
          sx={{
            display: 'inline-flex',
            minWidth: 'min-content',
            bgcolor: 'background.paper',
            ...headerRowSx,
          }}
        >
          {takes.map((take) => renderHeaderCell(take))}
          {headerControlColumn}
          {trailingSpacerWidth > 0 && (
            <Box
              sx={{
                width: trailingSpacerWidth,
                flexShrink: 0,
                bgcolor: 'background.paper',
              }}
            />
          )}
        </Box>
      </Box>

      {/* Marks content */}
      <Box
        sx={{
          display: 'inline-flex',
          minWidth: 'min-content',
          ...bodyRowSx,
        }}
      >
        {takes.map((take, takeIndex) => renderBodyColumn(take, takeIndex))}
        {bodyControlColumn}
        {trailingSpacerWidth > 0 && (
          <Box
            sx={{
              width: trailingSpacerWidth,
              flexShrink: 0,
            }}
          />
        )}
      </Box>
    </Box>
  );
}
