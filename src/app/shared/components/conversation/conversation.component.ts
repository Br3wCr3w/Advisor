import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from 'src/environments/environment';
import { RealtimeConnection } from 'src/app/ai/realtime-connection';

@Component({
  selector: 'app-conversation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.scss']
})
export class ConversationComponent implements OnInit {
  @ViewChild('apiKey') apiKey!: ElementRef<HTMLInputElement>;
  @ViewChild('connectBtn') connectBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('disconnectBtn') disconnectBtn!: ElementRef<HTMLButtonElement>;
  @ViewChild('status') status!: ElementRef<HTMLDivElement>;
  @ViewChild('remoteAudio') remoteAudio!: ElementRef<HTMLAudioElement>;
  @ViewChild('conversation') conversation!: ElementRef<HTMLDivElement>;

  // State variables for managing conversation UI
  currentParagraph: HTMLElement | null = null;
  transcriptionPlaceholder: HTMLElement | null = null;
  realtimeConnection: RealtimeConnection | null = null;

  constructor() {
    // Bind the methods to preserve 'this' context
    this.onStatus = this.onStatus.bind(this);
    this.onTranscriptDelta = this.onTranscriptDelta.bind(this);
    this.onTranscriptDone = this.onTranscriptDone.bind(this);
    this.onTranscriptCompleted = this.onTranscriptCompleted.bind(this);
    this.onConnectionSuccess = this.onConnectionSuccess.bind(this);
    this.onConnectionError = this.onConnectionError.bind(this);
    this.onSpeechStarted = this.onSpeechStarted.bind(this);
  }

  ngOnInit() {}

  ngAfterViewInit() {
    this.apiKey.nativeElement.value = environment?.apiKey || '';
  }

    /**
   * Helper function to automatically scroll the conversation container to the bottom
   * Called whenever new content is added to keep the latest messages visible
   */
  scrollToBottom() {
    this.conversation.nativeElement.scrollTop = this.conversation.nativeElement.scrollHeight;
  }

   /**
   * Updates the status message displayed to the user
   * @param {string} message - The status message to display
   */
   onStatus(message: string) {
    this.status.nativeElement.textContent = message;
  };

    /**
   * Handles incoming transcript deltas (partial responses) from the AI
   * Creates or updates paragraphs in the conversation UI
   * @param {string} delta - The new piece of transcript text
   * @param {string} itemId - Identifier for the transcript item
   */
    onTranscriptDelta(delta: string, itemId: string) {
      // If we're starting a new response, make new paragraph
      if (!this.currentParagraph) {
        this.currentParagraph = document.createElement('p');
        this.currentParagraph.innerHTML = '<span></span>';
        this.conversation.nativeElement.appendChild(this.currentParagraph);
        this.scrollToBottom();
      }
      const span = this.currentParagraph?.querySelector('span');
      if (span) {
        span.textContent += delta;
      }
      this.scrollToBottom();
    };

      /**
   * Handles the completion of an AI response transcript
   * Resets the current paragraph state
   */
  onTranscriptDone() {
    // End the paragraph
    this.currentParagraph = null;
  };

    /**
   * Creates a placeholder element when user starts speaking
   * Provides visual feedback that the system is waiting for transcription
   */
    onSpeechStarted() {
      if (!this.transcriptionPlaceholder) {
        this.transcriptionPlaceholder = document.createElement('p');
        this.transcriptionPlaceholder.classList.add('transcript-bubble');
        this.transcriptionPlaceholder.innerHTML = '<span>Waiting for transcription...</span>';
        this.conversation.nativeElement.appendChild(this.transcriptionPlaceholder);
        this.scrollToBottom();
      }
    };

     /**
   * Handles the completed transcription of user speech
   * Updates the placeholder or creates a new transcript bubble
   * @param {string} transcript - The complete transcribed text
   */
  onTranscriptCompleted(transcript: string) {
    // If we have a placeholder, update it
    if (this.transcriptionPlaceholder) {
      this.transcriptionPlaceholder.innerHTML = `<span>${transcript}</span>`;
      this.transcriptionPlaceholder = null;
    } else {
      // Fallback: create new bubble if no placeholder exists
      const transcriptParagraph = document.createElement('p');
      transcriptParagraph.classList.add('transcript-bubble');
      transcriptParagraph.innerHTML = `<span>${transcript}</span>`;
      this.conversation.nativeElement.appendChild(transcriptParagraph);
    }
    this.scrollToBottom();
  };

    /**
   * Handles successful connection to the realtime service
   * Enables the disconnect button
   */
  onConnectionSuccess() {
    this.disconnectBtn.nativeElement.disabled = false;
  };

   /**
   * Handles connection errors
   * Updates UI to show error state and re-enables connect button
   * @param {Error} err - The error that occurred
   */
  onConnectionError(err: Error) {
    console.error(err);
    this.status.nativeElement.textContent = `Connection error: ${err.message}`;
    this.connectBtn.nativeElement.disabled = false;
  };

  async connect() {
    console.log('connect');
    const standardApiKey = this.apiKey.nativeElement.value.trim();
    if (!standardApiKey) {
      this.status.nativeElement.textContent = 'Error: Please enter a valid OpenAI API key.';
      return;
    }

    this.connectBtn.nativeElement.disabled = true;

    // Instantiate a new RealtimeConnection with all callback handlers
    this.realtimeConnection = new RealtimeConnection({
      onStatus: this.onStatus,
      onTranscriptDelta: this.onTranscriptDelta,
      onTranscriptDone: this.onTranscriptDone,
      onTranscriptCompleted: this.onTranscriptCompleted,
      onConnectionSuccess: this.onConnectionSuccess,
      onConnectionError: this.onConnectionError,
      onSpeechStarted: this.onSpeechStarted
    });

    try {
      await this.realtimeConnection.connect(standardApiKey, this.remoteAudio.nativeElement);
    } catch (error) {
      // connection error is handled in onConnectionError
    }    
  }

  disconnect() {
    if (this.realtimeConnection) {
      this.realtimeConnection.disconnect();
      this.realtimeConnection = null;
    }
    this.connectBtn.nativeElement.disabled = false;
    this.disconnectBtn.nativeElement.disabled = true;
    this.status.nativeElement.textContent = 'Disconnected from Realtime API.';
  }

}
