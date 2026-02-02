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
  takes: Take[];
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  renderHeaderCell: (take: Take) => ReactNode;
  renderBodyColumn: (take: Take, takeIndex: number) => ReactNode;
  headerControlColumn?: ReactNode;
  bodyControlColumn?: ReactNode;
  trailingSpacerWidth?: number;
  scrollSx?: SxProps<Theme>;
  headerStickySx?: SxProps<Theme>;
  headerRowSx?: SxProps<Theme>;
  bodyRowSx?: SxProps<Theme>;
  renderFooterCell?: (take: Take) => ReactNode;
  footerControlColumn?: ReactNode;
  spacerColumnWidth?: number;
  spacerControlColumnWidth?: number;
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
  renderFooterCell,
  footerControlColumn,
  spacerColumnWidth,
  spacerControlColumnWidth,
}: MarksAreaProps) {
  return (
    <Box
      ref={scrollRef}
      onScroll={onScroll}
      data-testid="marks-scroll-area"
      sx={{
        flex: 1,
        overflowX: 'auto',
        overflowY: 'auto',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
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
          flexShrink: 0,
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
          flexShrink: 0,
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

      {/* Spacer row - fills gap between content and footer with column borders */}
      {renderFooterCell && spacerColumnWidth && (
        <Box
          sx={{
            flex: 1,
            display: 'inline-flex',
            minWidth: 'min-content',
            minHeight: 0,
          }}
        >
          {takes.map((take) => (
            <Box
              key={take.id}
              sx={{
                width: spacerColumnWidth,
                flexShrink: 0,
                borderRight: '1px solid',
                borderRightColor: 'divider',
              }}
            />
          ))}
          {spacerControlColumnWidth && (
            <Box
              sx={{
                width: spacerControlColumnWidth,
                flexShrink: 0,
              }}
            />
          )}
          {trailingSpacerWidth > 0 && (
            <Box
              sx={{
                width: trailingSpacerWidth,
                flexShrink: 0,
              }}
            />
          )}
        </Box>
      )}

      {/* Footer row - sticky at bottom */}
      {renderFooterCell && (
        <Box
          sx={{
            position: 'sticky',
            bottom: 0,
            zIndex: 2,
            bgcolor: 'background.paper',
            flexShrink: 0,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Box
            sx={{
              display: 'inline-flex',
              minWidth: 'min-content',
              bgcolor: 'background.paper',
            }}
          >
            {takes.map((take) => renderFooterCell(take))}
            {footerControlColumn}
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
      )}
    </Box>
  );
}
