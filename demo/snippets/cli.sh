npx m2aitestkit record .                  # call run() once, write a redacted recording
npx m2aitestkit run . --update-baseline   # evaluate it and save the baseline
git add .m2aitestkit                      # commit both

npx m2aitestkit run .                     # later: offline, no API key
