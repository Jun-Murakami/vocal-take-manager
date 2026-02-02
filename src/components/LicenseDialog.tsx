import { useEffect, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

import type { ReactElement } from 'react';

type LicenseInfo = {
  name: string;
  version: string;
  license: string;
  repository: string;
  publisher: string;
  url: string;
};

export type LicenseDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function LicenseDialog({
  open,
  onClose,
}: LicenseDialogProps): ReactElement {
  const [licenses, setLicenses] = useState<LicenseInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setError(null);

    fetch('/licenses.json')
      .then((res) => {
        if (!res.ok) throw new Error('ライセンス情報の取得に失敗しました');
        return res.json();
      })
      .then((data: LicenseInfo[]) => {
        setLicenses(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      sx={{ maxHeight: '80vh', my: 'auto' }}
    >
      <DialogTitle sx={{ fontFamily: 'Bebas Neue' }}>
        Open Source Licenses
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        )}
        {error && (
          <Typography color="error" sx={{ py: 2 }}>
            {error}
          </Typography>
        )}
        {!loading && !error && (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>パッケージ名</TableCell>
                  <TableCell>ライセンス</TableCell>
                  <TableCell>パブリッシャー</TableCell>
                  <TableCell>リンク</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {licenses.map((pkg) => (
                  <TableRow key={`${pkg.name}@${pkg.version}`}>
                    <TableCell>{pkg.name}</TableCell>
                    <TableCell>{pkg.license}</TableCell>
                    <TableCell>{pkg.publisher}</TableCell>
                    <TableCell>
                      {pkg.repository && (
                        <Link
                          href={pkg.repository}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Repository
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
    </Dialog>
  );
}
