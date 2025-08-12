import { environment } from "src/environments/environment";

export class RealtimeConnection {
    private peerConnection: RTCPeerConnection | null = null;
    private dataChannel: RTCDataChannel | null = null;
    private localStream: MediaStream | null = null;
    private lastItemId: string | null = null;
    private onStatus: (status: string) => void;
    private onTranscriptDelta: (delta: string, itemId: string) => void;
    private onTranscriptDone: () => void;
    private onTranscriptCompleted: (transcript: string) => void;
    private onConnectionSuccess: () => void;
    private onConnectionError: (error: Error) => void;
    private onSpeechStarted: () => void;
    constructor({
      onStatus,
      onTranscriptDelta,
      onTranscriptDone,
      onTranscriptCompleted,
      onConnectionSuccess,
      onConnectionError,
      onSpeechStarted
    }: {
      onStatus: (status: string) => void;
      onTranscriptDelta: (delta: string, itemId: string) => void;
      onTranscriptDone: () => void;
      onTranscriptCompleted: (transcript: string) => void;
      onConnectionSuccess: () => void;
      onConnectionError: (error: Error) => void;
      onSpeechStarted: () => void;
    }) {
      this.peerConnection = null;
      this.dataChannel = null;
      this.localStream = null;
      this.lastItemId = null;
      this.onStatus = onStatus;
      this.onTranscriptDelta = onTranscriptDelta;
      this.onTranscriptDone = onTranscriptDone;
      this.onTranscriptCompleted = onTranscriptCompleted;
      this.onConnectionSuccess = onConnectionSuccess;
      this.onConnectionError = onConnectionError;
      this.onSpeechStarted = onSpeechStarted;
    }
  
    async connect(standardApiKey: string, audioElement: HTMLAudioElement, voice: string = 'verse') {
      try {
        // Step 1: Acquire ephemeral key
        this.onStatus(`Requesting ephemeral key (voice: "${voice}")...`);
        const ephemeralResp = await fetch(environment.sessionsUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${standardApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-4o-realtime-preview-2024-12-17',
            voice
          })
        });
  
        if (!ephemeralResp.ok) {
          throw new Error('Failed to create ephemeral session. Check your standard API key and model name.');
        }
  
        const ephemeralData = await ephemeralResp.json();
        const ephemeralKey = ephemeralData.client_secret?.value;
        if (!ephemeralKey) {
          throw new Error('Ephemeral key not found in response.');
        }
  
        this.onStatus('Ephemeral key acquired. Initializing WebRTC...');
  
        // Step 2: Create peer connection
        this.peerConnection = new RTCPeerConnection();
        this.peerConnection.ontrack = (event) => {
          audioElement.srcObject = event.streams[0];
        };
  
        // Step 3: Create data channel
        this.dataChannel = this.peerConnection.createDataChannel('oai-events');
        this.dataChannel.onopen = () => {
          // Send session.update event
          const updateEvent = {
            event_id: "event_123",
            type: "session.update",
            session: {
              modalities: ["text", "audio"],
              instructions: "You are a helpful assistant.",
              voice,
              input_audio_format: "pcm16",
              output_audio_format: "pcm16",
              input_audio_transcription: {
                model: "whisper-1"
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 500,
                create_response: true
              },
              tools: [
                {
                  type: "function",
                  name: "get_weather",
                  description: "Get the current weather...",
                  parameters: {
                    type: "object",
                    properties: {
                      location: { type: "string" }
                    },
                    required: ["location"]
                  }
                }
              ],
              tool_choice: "auto",
              temperature: 0.8,
              max_response_output_tokens: "inf"
            }
          };
          this.dataChannel?.send(JSON.stringify(updateEvent));
        };
  
        // Step 4: Listen for data channel messages
        this.dataChannel.onmessage = (event) => {
          const response = JSON.parse(event.data);
          console.log(response);
          
          // If item_id changes, reset
          if (response.item_id !== this.lastItemId) {
            this.lastItemId = response.item_id;
          }
  
          // Check response type
          switch (response.type) {
            case 'input_audio_buffer.speech_started':
              if (this.onSpeechStarted) {
                this.onSpeechStarted();
              }
              break;
            case 'response.done':
              // End of a response
              break;
            case 'response.audio_transcript.delta':
              if (response.delta && this.onTranscriptDelta) {
                this.onTranscriptDelta(response.delta, response.item_id);
              }
              break;
            case 'response.audio_transcript.done':
              if (this.onTranscriptDone) {
                this.onTranscriptDone();
              }
              break;
            case 'conversation.item.input_audio_transcription.completed':
              if (this.onTranscriptCompleted) {
                // Clean up the transcript by removing newlines and extra whitespace
                const cleanTranscript = response.transcript.trim().replace(/\n/g, ' ');
                this.onTranscriptCompleted(cleanTranscript);
              }
              break;
            default:
              // Handle other message types if needed
              break;
          }
        };
  
        // Step 5: Get local microphone stream
        this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.localStream.getTracks().forEach(track => this.peerConnection?.addTrack(track, this.localStream!));
  
        // Step 6: Create and set local offer
        const offer = await this.peerConnection.createOffer();
        await this.peerConnection.setLocalDescription(offer);
  
        // Step 7: Send local SDP to Realtime API
        this.onStatus('Sending local description (offer) to Realtime API...');
        const baseUrl = 'https://api.openai.com/v1/realtime';
        const model = 'gpt-4o-realtime-preview-2024-12-17';
        const sdpResp = await fetch(`${baseUrl}?model=${model}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp'
          },
          body: offer.sdp
        });
  
        if (!sdpResp.ok) {
          throw new Error('Failed to receive SDP answer from the Realtime API.');
        }
  
        const serverAnswer: RTCSessionDescriptionInit = {
          type: 'answer' as RTCSdpType,
          sdp: await sdpResp.text()
        };
        await this.peerConnection.setRemoteDescription(serverAnswer);
  
        this.onStatus(`Connected to Realtime API with voice: "${voice}"`);
        if (this.onConnectionSuccess) {
          this.onConnectionSuccess();
        }
      } catch (err) {
        if (this.onConnectionError) {
          this.onConnectionError(err instanceof Error ? err : new Error(String(err)));
        }
        throw err;
      }
    }
  
    disconnect() {
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }
    }
  } 