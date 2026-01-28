/**
 * Bottom panel UI helpers shared between Recording/Comping screens.
 * Common layout and navigation controls are centralized here to keep the screens slim.
 */

import type { ReactNode } from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Box, Button, IconButton } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface BottomPanelProps {
  // 上部（現在位置や歌詞など）を描画するコンテンツ
  topContent: ReactNode;
  // 下部（ボタンや入力など）を描画するコンテンツ
  bottomContent: ReactNode;
  // パネル全体の高さ（未指定なら自動）
  height?: number;
  // パネルのパディング（未指定なら 2）
  padding?: number;
  // 印刷時にパネルを非表示にするか
  hideOnPrint?: boolean;
}

/**
 * BottomPanel
 * - Recording/Comping で共通する「上下2段のパネル」構造を共通化
 * - 表示専用の入れ物として使い、内容は上位で組み立てる
 */
export function BottomPanel({
  topContent,
  bottomContent,
  height,
  padding = 2,
  hideOnPrint = false,
}: BottomPanelProps) {
  return (
    <Box
      sx={{
        p: padding,
        borderTop: 1,
        borderColor: 'divider',
        height: height ?? 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        // 印刷時に非表示にする（必要な画面のみ指定）
        '@media print': hideOnPrint
          ? {
              display: 'none',
            }
          : undefined,
      }}
    >
      {topContent}
      {bottomContent}
    </Box>
  );
}

interface DeleteAndNavControlsProps {
  // Delete ボタンの押下時処理
  onDelete: () => void;
  // 前のフレーズへ移動
  onPrev: () => void;
  // 次のフレーズへ移動
  onNext: () => void;
  // Delete ボタンのラベル（既定は "DEL"）
  deleteLabel?: string;
  // Delete ボタンのサイズ調整
  deleteButtonMinWidth?: number;
  deleteButtonHeight?: number;
  // 前後移動ボタンのサイズ調整
  navButtonHeight?: number;
  // 追加のスタイル（アニメーションなど）
  deleteButtonSx?: SxProps<Theme>;
  prevButtonSx?: SxProps<Theme>;
  nextButtonSx?: SxProps<Theme>;
}

/**
 * DeleteAndNavControls
 * - DEL / 前 / 次 の共通ボタン群を切り出し
 * - Recording/Comping の両方で同じ見た目を使う
 */
export function DeleteAndNavControls({
  onDelete,
  onPrev,
  onNext,
  deleteLabel = 'DEL',
  deleteButtonMinWidth = 56,
  deleteButtonHeight,
  navButtonHeight,
  deleteButtonSx,
  prevButtonSx,
  nextButtonSx,
}: DeleteAndNavControlsProps) {
  return (
    <>
      {/* マーク/採用の削除ボタン */}
      <Button
        variant="contained"
        size="small"
        onClick={onDelete}
        sx={{
          minWidth: deleteButtonMinWidth,
          height: deleteButtonHeight,
          borderRadius: 1,
          ...deleteButtonSx,
        }}
      >
        {deleteLabel}
      </Button>
      {/* 前後移動ボタン */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <IconButton
          onClick={onPrev}
          size="small"
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            color: 'primary.contrastText',
            backgroundColor: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            height: navButtonHeight,
            ...prevButtonSx,
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <IconButton
          onClick={onNext}
          size="small"
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            color: 'primary.contrastText',
            backgroundColor: 'primary.main',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            height: navButtonHeight,
            ...nextButtonSx,
          }}
        >
          <ArrowForwardIcon />
        </IconButton>
      </Box>
    </>
  );
}
