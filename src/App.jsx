import React, { useState, useRef } from "react";

import { Button } from "@/components/ui/button";

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const App = () => {
    const [initScreen, setinitScreen] = useState(true);
    const [localStream, setLocalStream] = useState();
    const [isCameraOpen, setIsCameraOpen] = useState(false);

    const firebaseConfig = {
        apiKey: import.meta.env.VITE_API_KEY,
        authDomain: import.meta.env.VITE_AUTH_DOMAIN,
        projectId: import.meta.env.VITE_PROJECT_ID,
        storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
        messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
        appId: import.meta.env.VITE_APP_ID,
        measurementId: import.meta.env.VITE_MEASUREMENT_ID,
    };

    const fbApp = initializeApp(firebaseConfig);
    const firestore = getFirestore(fbApp);
    const servers = {
        iceServers: [
            {
                urls: [
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                ],
            },
        ],
        iceCandidatePoolSize: 10,
    };

    // Global Vars
    const pc = new RTCPeerConnection(servers);
    let remoteStream = null;

    // HTML Els
    const webcamVideoRef = useRef(null);
    const callButton = document.getElementById("callButton");
    const callInput = document.getElementById("callInput");
    const answerButton = document.getElementById("answerButton");
    const remoteVideo = document.getElementById("remoteVideo");
    const hangupButton = document.getElementById("hangupButton");

    const startCamera = async () => {
        setIsCameraOpen(true);
        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });
        setLocalStream(stream);
        remoteStream = new MediaStream();

        // Push tracks from local stream to peer connection
        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        // Pull tracks from remote stream, add to video stream
        pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        };

        webcamVideoRef.current.srcObject = stream;
        // remoteVideo.srcObject = remoteStream;

        // callButton.disabled = false;
        // answerButton.disabled = false;
        // webcamButton.disabled = true;
    };

    const stopCamera = () => {
        localStream.getTracks().forEach((track) => track.stop());
        setIsCameraOpen(false);
    };

    return (
        <main className="mx-auto max-w-[450px] h-screen px-4 py-4 overflow-hidden">
            <div
                id="view"
                className="h-full w-full bg-slate-800 rounded-3xl overflow-hidden relative"
            >
                {initScreen && (
                    <div className="h-full w-full flex flex-col gap-4 items-center justify-center relative">
                        {!isCameraOpen ? (
                            <Button variant="secondary" onClick={startCamera}>
                                Start Camera
                            </Button>
                        ) : (
                            <Button variant="secondary" onClick={stopCamera}>
                                Stop Camera
                            </Button>
                        )}
                    </div>
                )}

                <video
                    ref={webcamVideoRef}
                    id="webcamVideo"
                    autoPlay
                    playsInline
                    muted
                    className="w-full max-w-[90px] aspect-[9/16] bg-white absolute bottom-4 right-4 rounded-2xl overflow-hidden object-cover object-center shadow-md"
                />
            </div>
        </main>
    );
};

export default App;
