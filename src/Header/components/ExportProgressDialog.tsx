import {
  Dialog,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Typography,
} from "@mui/material";

// Progress of an in-flight video export. "uploading" covers rendering and
// uploading the frames (we know the total, so the bar is determinate);
// "processing" is the server-side encoding, whose duration we cannot predict, so
// the bar is indeterminate.
export type ExportProgress =
  | { phase: "uploading"; uploaded: number; total: number }
  | { phase: "processing" };

export default function ExportProgressDialog({
  progress,
}: {
  progress: ExportProgress | null;
}) {
  const percent =
    progress?.phase === "uploading" && progress.total > 0
      ? Math.round((progress.uploaded / progress.total) * 100)
      : 0;

  return (
    <Dialog
      open={progress !== null}
      disableEscapeKeyDown
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>Exporting video</DialogTitle>
      <DialogContent>
        {progress?.phase === "uploading" ? (
          <>
            <DialogContentText sx={{ mb: 2 }}>
              Preparing frames… {percent}%
            </DialogContentText>
            <LinearProgress variant="determinate" value={percent} />
          </>
        ) : (
          <>
            <DialogContentText sx={{ mb: 2 }}>
              Encoding your video on the server…
            </DialogContentText>
            <LinearProgress />
          </>
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mt: 2 }}
        >
          This can take a few minutes. Please keep this tab open until the
          download starts.
        </Typography>
      </DialogContent>
    </Dialog>
  );
}
