import "./style.css";

import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_API_KEY,
    authDomain: import.meta.env.VITE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_ID,
    measurementId: import.meta.env.VITE_MEASUREMENT_ID,
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

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

// Global State
const pc = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;

// HTML elements
const webcamButton = document.getElementById("webcamButton");
const webcamButtonStop = document.getElementById("webcamButtonStop");
const joinLink = document.getElementById("joinLink");
const webcamVideo = document.getElementById("webcamVideo");
const callButton = document.getElementById("callButton");
const callInput = document.getElementById("callInput");
const answerButton = document.getElementById("answerButton");
const remoteVideo = document.getElementById("remoteVideo");
const hangupButton = document.getElementById("hangupButton");
const expandIcon = document.getElementById("expandIcon");
const shrinkIcon = document.getElementById("shrinkIcon");

webcamButtonStop.disabled = true;
callButton.disabled = true;
answerButton.disabled = true;

webcamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
    });
    remoteStream = new MediaStream();

    // Push tracks from local stream to peer connection
    localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
    });

    // Pull tracks from remote stream, add to video stream
    pc.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    };

    webcamVideo.srcObject = localStream;
    remoteVideo.srcObject = remoteStream;

    webcamButton.disabled = true;
    webcamButtonStop.disabled = false;
    callButton.disabled = false;
    answerButton.disabled = false;
};

webcamButtonStop.onclick = () => {
    localStream.getTracks().forEach((track) => track.stop());

    webcamButton.disabled = false;
    webcamButtonStop.disabled = true;
    callButton.disabled = true;
    answerButton.disabled = true;

    expandIcon.classList.add("hidden");
    expandIcon.classList.remove("flex");
};

callButton.onclick = async () => {
    // Reference Firestore collections for signaling
    const callDoc = firestore.collection("calls").doc();
    const offerCandidates = callDoc.collection("offerCandidates");
    const answerCandidates = callDoc.collection("answerCandidates");

    callInput.value = callDoc.id;
    joinLink.innerText = callDoc.id;

    // Get candidates for caller, save to db
    pc.onicecandidate = (event) => {
        event.candidate && offerCandidates.add(event.candidate.toJSON());
    };

    // Create offer
    const offerDescription = await pc.createOffer();
    await pc.setLocalDescription(offerDescription);

    const offer = {
        sdp: offerDescription.sdp,
        type: offerDescription.type,
    };

    await callDoc.set({ offer });

    // Listen for remote answer
    callDoc.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
        }
    });

    // When answered, add candidate to peer connection
    answerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                const candidate = new RTCIceCandidate(change.doc.data());
                pc.addIceCandidate(candidate);
            }
        });
    });

    hangupButton.disabled = false;
    expandIcon.classList.remove("hidden");
    expandIcon.classList.add("flex");
};

expandIcon.onclick = (e) => {
    e.currentTarget.classList.remove("flex");
    e.currentTarget.classList.add("hidden");

    shrinkIcon.classList.remove("hidden");
    shrinkIcon.classList.add("flex");
    hangupButton.classList.remove("hidden");
    hangupButton.classList.add("flex");

    remoteVideo.dataset.expanded = "true";
};

shrinkIcon.onclick = (e) => {
    e.currentTarget.classList.remove("flex");
    e.currentTarget.classList.add("hidden");

    expandIcon.classList.remove("hidden");
    expandIcon.classList.add("flex");
    hangupButton.classList.remove("flex");
    hangupButton.classList.add("hidden");

    remoteVideo.dataset.expanded = "false";
};

answerButton.onclick = async () => {
    const callId = callInput.value;
    const callDoc = firestore.collection("calls").doc(callId);
    const answerCandidates = callDoc.collection("answerCandidates");
    const offerCandidates = callDoc.collection("offerCandidates");

    pc.onicecandidate = (event) => {
        event.candidate && answerCandidates.add(event.candidate.toJSON());
    };

    const callData = (await callDoc.get()).data();

    const offerDescription = callData.offer;
    await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

    const answerDescription = await pc.createAnswer();
    await pc.setLocalDescription(answerDescription);

    const answer = {
        type: answerDescription.type,
        sdp: answerDescription.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                let data = change.doc.data();
                pc.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });

    shrinkIcon.classList.remove("hidden");
    shrinkIcon.classList.add("flex");
    expandIcon.classList.add("hidden");
    expandIcon.classList.remove("flex");
    hangupButton.classList.remove("hidden");
    hangupButton.classList.add("flex");

    remoteVideo.dataset.expanded = "true";
};

hangupButton.onclick = () => location.reload();

const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
});
if (params.join) {
    callInput.value = params.join;
}

joinLink.onclick = () => {
    navigator.clipboard.writeText(
        `https://${import.meta.env.VITE_WEBSITE_URL}/?join=${callInput.value}`
    );
};
