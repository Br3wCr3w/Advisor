import { Component, ElementRef, OnInit, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from 'src/environments/environment';
import { RealtimeConnection } from 'src/app/ai/realtime-connection';
import { IonList, IonItem, IonButton, IonContent, IonLabel } from '@ionic/angular/standalone';

interface Message {
  text: string;
  isUser: boolean;
  isPartial?: boolean;
  itemId?: string;
  placeholder?: boolean;
}

@Component({
  selector: 'app-conversation',
  standalone: true,
  imports: [CommonModule, IonList, IonItem, IonButton, IonContent, IonLabel],
  templateUrl: './conversation.component.html',
  styleUrls: ['./conversation.component.scss']
})
export class ConversationComponent implements OnInit {
  @ViewChild('apiKey') apiKey!: ElementRef<HTMLInputElement>;
  @ViewChild('status') status!: ElementRef<HTMLDivElement>;
  @ViewChild('remoteAudio') remoteAudio!: ElementRef<HTMLAudioElement>;
  @ViewChild(IonContent) content!: IonContent;

  messages: Message[] = [];
  realtimeConnection: RealtimeConnection | null = null;
  currentMessage: Message | null = null;
  currentUserMessage: Message | null = null;
  isConnectDisabled = false;
  isDisconnectDisabled = true;

  constructor(private cdr: ChangeDetectorRef) {
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

  async scrollToBottom() {
    await this.content.scrollToBottom(300);
  }

  onStatus(message: string) {
    this.status.nativeElement.textContent = message;
  }

  onTranscriptDelta(delta: string, itemId: string) {
    console.log('Delta received:', delta, 'itemId:', itemId);
    
    // If we have a new itemId or no current message, start a new message
    if (!this.currentMessage || (this.currentMessage.itemId !== itemId)) {
      // First, ensure we have a placeholder for the user's message
      if (!this.currentUserMessage) {
        this.currentUserMessage = {
          text: 'Waiting for transcription...',
          isUser: true,
          isPartial: true,
          placeholder: true,
          itemId: 'user-' + Date.now()
        };
        this.messages.push(this.currentUserMessage);
      }

      // Then create the new LLM message
      this.currentMessage = {
        text: '',
        isUser: false,
        isPartial: true,
        itemId: itemId
      };
      this.messages.push(this.currentMessage);
    }
    
    // Always append the delta to the current message
    this.currentMessage.text += delta;
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  onTranscriptDone() {
    console.log('Transcript done, final text:', this.currentMessage?.text, 'itemId:', this.currentMessage?.itemId);
    if (this.currentMessage) {
      this.currentMessage.isPartial = false;
      this.cdr.detectChanges();
    }
    this.currentMessage = null;
  }

  onSpeechStarted() {
    console.log('Speech started');
    // Don't create a new message if we already have a placeholder
    if (!this.currentUserMessage) {
      this.currentUserMessage = {
        text: 'Waiting for transcription...',
        isUser: true,
        isPartial: true,
        placeholder: true,
        itemId: 'user-' + Date.now()
      };
      this.messages.push(this.currentUserMessage);
      this.cdr.detectChanges();
      this.scrollToBottom();
    }
  }

  onTranscriptCompleted(transcript: string) {
    console.log('Transcript completed:', transcript);
    if (this.currentUserMessage) {
      // Update the existing placeholder message
      this.currentUserMessage.text = transcript;
      this.currentUserMessage.isPartial = false;
      this.currentUserMessage.placeholder = false;
    } else {
      // If no placeholder exists (shouldn't happen), create new message
      this.currentUserMessage = {
        text: transcript,
        isUser: true,
        isPartial: false,
        itemId: 'user-' + Date.now()
      };
      this.messages.push(this.currentUserMessage);
    }
    this.currentUserMessage = null;  // Reset the current user message
    this.cdr.detectChanges();
    this.scrollToBottom();
  }

  onConnectionSuccess() {
    this.isDisconnectDisabled = false;
  }

  onConnectionError(err: Error) {
    console.error(err);
    this.status.nativeElement.textContent = `Connection error: ${err.message}`;
    this.isConnectDisabled = false;
  }

  async connect() {
    console.log('connect');
    const standardApiKey = this.apiKey.nativeElement.value.trim();
    if (!standardApiKey) {
      this.status.nativeElement.textContent = 'Error: Please enter a valid OpenAI API key.';
      return;
    }

    this.isConnectDisabled = true;

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
    this.isConnectDisabled = false;
    this.isDisconnectDisabled = true;
    this.status.nativeElement.textContent = 'Disconnected from Realtime API.';
  }

}
