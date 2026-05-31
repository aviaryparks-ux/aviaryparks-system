import { NextResponse } from 'next/server';
import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

const APP_ID = 'cce1fd6074a541e9ae816a873da217f1';
const APP_CERTIFICATE = '456051080c814120a0bb249e7672896f';

export async function POST(req: Request) {
  try {
    const { channelName, uid } = await req.json();

    if (!channelName) {
      return NextResponse.json({ error: 'channelName is required' }, { status: 400 });
    }

    // Convert string uid to integer for Agora RtcTokenBuilder (range 1-65535)
    let intUid = 0;
    if (uid && typeof uid === 'string') {
      // Hash string uid to a 32-bit integer
      let hash = 0;
      for (let i = 0; i < uid.length; i++) {
        hash = (hash << 5) - hash + uid.charCodeAt(i);
        hash |= 0;
      }
      intUid = (Math.abs(hash) % 65534) + 1; // Range 1 - 65535
    } else if (typeof uid === 'number') {
      intUid = uid % 65535;
    }

    // Role is publisher for calling
    const role = RtcRole.PUBLISHER;
    // Token valid for 2 hours
    const expirationTimeInSeconds = 3600 * 2;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      intUid,
      role,
      privilegeExpiredTs
    );

    return NextResponse.json({ 
      token,
      uid: intUid, // return the generated int uid
      appId: APP_ID
    });
  } catch (error: any) {
    console.error("Agora token error:", error);
    return NextResponse.json({ error: error.message || 'Failed to generate token' }, { status: 500 });
  }
}
