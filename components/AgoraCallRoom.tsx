// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import AgoraRTC, { IAgoraRTCRemoteUser, ICameraVideoTrack, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import {
  AgoraRTCProvider,
  useRTCClient,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
  useRemoteAudioTracks,
  useRemoteVideoTracks,
  LocalVideoTrack,
  RemoteVideoTrack
} from 'agora-rtc-react';

interface AgoraCallRoomProps {
  channelName: string;
  appId: string;
  token: string;
  uid: number;
  onEndCall: () => void;
  isVideoCall?: boolean;
}

export function AgoraCallRoom({ channelName, appId, token, uid, onEndCall, isVideoCall = true }: AgoraCallRoomProps) {
  // Menggunakan H264 karena aplikasi Mobile (Flutter/Android) secara default menggunakan H264 hardware encoding
  const client = useRTCClient(AgoraRTC.createClient({ codec: 'h264', mode: 'rtc' }));

  return (
    <AgoraRTCProvider client={client}>
      <CallView 
        channelName={channelName} 
        appId={appId} 
        token={token} 
        uid={uid} 
        onEndCall={onEndCall} 
        isVideoCall={isVideoCall}
      />
    </AgoraRTCProvider>
  );
}

function CallView({ channelName, appId, token, uid, onEndCall, isVideoCall }: AgoraCallRoomProps) {
  const client = useRTCClient();
  const [joined, setJoined] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [camOff, setCamOff] = useState(!isVideoCall);

  const { localMicrophoneTrack } = useLocalMicrophoneTrack();
  const { localCameraTrack } = useLocalCameraTrack(isVideoCall && !camOff);

  const remoteUsers = useRemoteUsers();
  const { audioTracks } = useRemoteAudioTracks(remoteUsers);
  const { videoTracks } = useRemoteVideoTracks(remoteUsers);

  useEffect(() => {
    let active = true;
    let joinAttempted = false;

    const joinChannel = async () => {
      if (joinAttempted) return;
      joinAttempted = true;
      
      const safeUid = Number(uid);
      console.error("DEBUG AGORA -> APPID:", appId, "CHANNEL:", channelName, "SAFE UID:", safeUid);
      
      try {
        await client.join(appId, channelName, token, safeUid);
        if (active) setJoined(true);
      } catch (err: any) {
        if (err?.code === 'UID_CONFLICT') {
          console.warn('UID conflict, already joined.');
          if (active) setJoined(true);
        } else if (err?.code === 'OPERATION_ABORTED') {
          console.warn('Join aborted due to unmount.');
        } else {
          console.error('Failed to join channel:', err);
        }
      }
    };
    
    joinChannel();

    return () => {
      active = false;
      try {
        client.leave().catch((e) => console.log('Leave promise caught:', e));
      } catch (err) {
        console.log('Ignored sync error on leave:', err);
      }
    };
  }, [client, appId, channelName, token, uid]);

  usePublish([
    localMicrophoneTrack,
    (!camOff && localCameraTrack) ? localCameraTrack : null
  ].filter(Boolean) as (IMicrophoneAudioTrack | ICameraVideoTrack)[]);

  useEffect(() => {
    audioTracks.forEach((track) => track.play());
    return () => {
      audioTracks.forEach((track) => track.stop());
    };
  }, [audioTracks]);

  // Auto-hangup when the other person leaves
  useEffect(() => {
    const handleUserLeft = () => {
      leaveCall();
    };
    client.on("user-left", handleUserLeft);
    return () => {
      client.off("user-left", handleUserLeft);
    };
  }, [client]);

  const toggleMic = async () => {
    if (localMicrophoneTrack) {
      await localMicrophoneTrack.setMuted(!micMuted);
      setMicMuted(!micMuted);
    }
  };

  const toggleCam = async () => {
    if (localCameraTrack) {
      await localCameraTrack.setMuted(!camOff);
      setCamOff(!camOff);
    } else {
      setCamOff(!camOff);
    }
  };

  const leaveCall = async () => {
    await client.leave();
    onEndCall();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <div className="text-white mb-4 text-center">
        <h2 className="text-xl font-bold">{isVideoCall ? 'Video Call' : 'Voice Call'}</h2>
        <p className="text-gray-400">Status: {joined ? 'Tersambung' : 'Menyambungkan...'}</p>
        <p className="text-sm text-gray-500">Room: {channelName}</p>
      </div>

      <div className="flex-1 w-full max-w-4xl relative flex items-center justify-center bg-gray-900 rounded-2xl overflow-hidden mb-6 border border-gray-800 shadow-2xl">
        {/* Remote Video */}
        {remoteUsers.length > 0 ? (
          videoTracks.length > 0 ? (
             <div className="w-full h-full relative">
               <RemoteVideoTrack key={videoTracks[0].getTrackId()} track={videoTracks[0]} style={{ width: '100%', height: '100%' }} className="object-cover" />
               <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white text-sm">
                 {remoteUsers[0].uid}
               </div>
             </div>
          ) : (
            <div className="text-white text-center">
              <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold">{remoteUsers[0].uid.toString().substring(0,2)}</span>
              </div>
              <p>Lawan bicara mematikan kamera</p>
            </div>
          )
        ) : (
          <div className="text-white text-center animate-pulse">
            <p>Menunggu pihak lain bergabung...</p>
          </div>
        )}

        {/* Local Video (PiP) */}
        {isVideoCall && !camOff && localCameraTrack && (
          <div className="absolute top-4 right-4 w-32 h-44 bg-gray-800 rounded-lg overflow-hidden border-2 border-emerald-500 shadow-lg">
            <LocalVideoTrack key={localCameraTrack.getTrackId()} track={localCameraTrack} style={{ width: '100%', height: '100%' }} className="object-cover" />
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-6 bg-gray-800 px-8 py-4 rounded-full shadow-lg">
        <button 
          onClick={toggleMic}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${micMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {micMuted ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z m7.414-2l3-3m0 0l3-3m-3 3l-3-3m3 3l3 3" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            )}
          </svg>
        </button>

        {isVideoCall && (
          <button 
            onClick={toggleCam}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${camOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600 hover:bg-gray-500'}`}
          >
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {camOff ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M15 14v2a1 1 0 01-1 1H4a1 1 0 01-1-1V8a1 1 0 011-1h10a1 1 0 011 1v6z" />
              )}
            </svg>
          </button>
        )}

        <button 
          onClick={leaveCall}
          className="w-16 h-12 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-md"
        >
          <svg className="w-6 h-6 text-white transform rotate-[135deg]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
