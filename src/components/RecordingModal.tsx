import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AudioRecorder } from './AudioRecorder';
import { Task } from './TaskCard';
import { Volume2, Save, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecordingModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | null;
  onSubmit: (taskId: string, audioBlob: Blob, notes?: string) => void;
}

export const RecordingModal: React.FC<RecordingModalProps> = ({
  isOpen,
  onClose,
  task,
  onSubmit,
}) => {
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  if (!task) return null;

  const handleRecordingComplete = (blob: Blob) => {
    setAudioBlob(blob);
  };

  const handleSubmit = async () => {
    if (!audioBlob) {
      toast({
        title: "No recording found",
        description: "Please record your translation before submitting.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(task.id, audioBlob, notes);
      toast({
        title: "Recording submitted!",
        description: "Thank you for your contribution to preserving indigenous languages.",
      });
      onClose();
      setAudioBlob(null);
      setNotes('');
    } catch (error) {
      toast({
        title: "Submission failed",
        description: "There was an error submitting your recording. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAudioBlob(null);
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-foreground">
                Record Translation
              </DialogTitle>
              <DialogDescription>
                Record your translation of the English text into your indigenous language
              </DialogDescription>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleClose}
              className="shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Task Information */}
          <div className="bg-earth-warm p-4 rounded-lg space-y-3">
            <div className="flex items-center space-x-2">
              <Badge className="bg-earth-primary text-white">
                {task.type}
              </Badge>
              <Badge variant="outline" className="text-earth-deep">
                {task.difficulty}
              </Badge>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-earth-primary" />
                <span className="text-sm font-medium text-earth-deep">
                  English Text to Translate:
                </span>
              </div>
              <p className="text-lg font-semibold text-foreground bg-white p-3 rounded border-l-4 border-earth-primary">
                "{task.englishText}"
              </p>
            </div>

            {task.description && (
              <p className="text-sm text-muted-foreground italic">
                {task.description}
              </p>
            )}
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 p-4 rounded-lg border-l-4 border-blue-400">
            <h4 className="font-semibold text-blue-800 mb-2">Recording Instructions:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Speak clearly and at a natural pace</li>
              <li>• Record in a quiet environment</li>
              <li>• Provide an accurate translation in your indigenous language</li>
              <li>• You can re-record if needed before submitting</li>
            </ul>
          </div>

          {/* Audio Recorder */}
          <div className="space-y-4">
            <h4 className="font-semibold text-foreground">Your Recording:</h4>
            <AudioRecorder 
              onRecordingComplete={handleRecordingComplete}
              maxDuration={60}
            />
          </div>

          {/* Optional Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Additional Notes (Optional)
            </label>
            <Textarea
              placeholder="Add any context, pronunciation notes, or cultural information about your translation..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!audioBlob || isSubmitting}
              className="bg-earth-primary hover:bg-earth-primary/90"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Submitting...' : 'Submit Recording'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};