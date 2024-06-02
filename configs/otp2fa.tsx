
import { URI, TOTP } from 'otpauth';
import {findOtp, insertOtp } from './prisma'
// import { useState, useEffect } from 'react'

export async function  TwoFactorAuth() {
  
    let totp: TOTP
    // const [otpuri, setOtpuri] = useState('')
    // const [secret, setSecret] = useState('');
    // const [otpCode, setOtpCode] = useState('');
    // const [timeRemaining, setTimeRemaining] = useState(30)
    // const [period, setPeriod] = useState(30)
    let otpuri: string = ""
    let secret: string = ""
    let otpCode = ""
    let timeRemaining = 30
    let period = 30
        
    const totpdb = await findOtp()
    totp = new TOTP({
        label: totpdb.label,
        secret: totpdb.secret,
        algorithm: totpdb.algorithm,
        issuer: totpdb.issuer,
        issuerInLabel: totpdb.issuer,
        period: totpdb.period,
        digits: totpdb.digits,
    })

    // setSecret(totpdb.secrect)
    // setPeriod(totpdb.period)
    // setOtpCode(totp.generate());
    secret = totpdb.secrect
    period = totpdb.period
    otpCode = totp.generate()


        const updateOtpAndTimeRemaining = () => {
        // Generate the current OTP code based on the user's secret key

        // Update the time remaining for the OTP code
        const t = (period * (1 - ((Date.now() / 1000 / period) % 1))) | 0;
        // setTimeRemaining(t);
        timeRemaining = t

        // Update the OTP code when the time remaining is 0
        if (t === 0) {
            // setOtpCode(totp.generate());
            otpCode = totp.generate();
        }
        console.log(otpCode, timeRemaining)
    };

    // Start the OTP code and time remaining update interval
    const interval = setInterval(updateOtpAndTimeRemaining, 1000);



  const handleVerifyOtpUrl = () => {
    // Validate the input OTP URL
    const otpUrlRegex = /^otpauth:\/\/(?:totp|hotp)\/[^?]+\?(?:[^&]+&)*secret=([^&]+)(?:&(?:period=(\d+)|digits=(\d+)|algorithm=(\w+)))*$/;
    const match = otpuri.match(otpUrlRegex);

    if (match) {
      const totp = URI.parse(otpuri)
      const otpCode = totp.generate()
      const isValid = totp.validate({ token: otpCode });
      if (isValid) {
        alert('OTP URL is valid!');
      } else {
        alert('Invalid OTP code!');
      }
    } else {
      alert('Invalid OTP URL!');
    }
  };

  return (
    <div>
      <h1>Two-Factor Authentication</h1>
      <p>Your secret key: {secret}</p>
      <p>Time remaining: {timeRemaining} seconds</p>
      <p>OTP code: {otpCode}</p>
      <input
        type="text"
        value=''
        // onChange={(e) => {(otpuri = e.target.value)}}
        placeholder="Enter OTP URL"
      />
      {/* <button onClick={handleVerifyOtpUrl}>Verify OTP URL</button> */}
    </div>
  );
}