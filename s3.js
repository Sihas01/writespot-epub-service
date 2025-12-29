const {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} = require("@aws-sdk/client-s3");
const fs = require("fs");
const stream = require("stream");
const { promisify } = require("util");

const pipeline = promisify(stream.pipeline);

const s3 = new S3Client({ region: "us-east-1" });

exports.download = async (bucket, key, path) => {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  await pipeline(res.Body, fs.createWriteStream(path));
};

exports.upload = async (bucket, key, path) => {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(path),
      ContentType: "application/epub+zip",
    })
  );
};

exports.getStream = async (bucket, key) => {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return res.Body; // Returns a readable stream
};